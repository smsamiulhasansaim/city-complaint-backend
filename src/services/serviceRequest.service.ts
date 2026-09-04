import { Prisma, ServiceRequestStatus } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';
import { AppRole } from '../utils/jwt';
import { publicUserSelect } from './complaint.service';

export const serviceRequestInclude = {
  service: { select: { id: true, name: true, fee: true, isActive: true } },
  citizen: { select: publicUserSelect },
  assignedAgent: { select: publicUserSelect },
  payment: {
    select: {
      id: true,
      status: true,
      amount: true,
      transactionId: true,
      paidAt: true,
    },
  },
} satisfies Prisma.ServiceRequestInclude;

const AGENT_ALLOWED_STATUSES: ServiceRequestStatus[] = [
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
];

/** Payment moves PENDING_PAYMENT → PAID; everything after is staff workflow. */
const STATUS_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  PENDING_PAYMENT: [],
  PAID: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['COMPLETED'],
  REJECTED: [],
  COMPLETED: [],
};

const assertCanView = (
  sr: { citizenId: string; assignedAgentId: string | null },
  role: AppRole,
  userId: string
): void => {
  if (role === 'ADMIN') return;
  if (role === 'CITIZEN' && sr.citizenId === userId) return;
  if (role === 'AGENT' && sr.assignedAgentId === userId) return;
  throw new AppError('You do not have permission to view this service request.', 403);
};

export const createServiceRequest = async (
  citizenId: string,
  input: { serviceId: string; details?: string }
) => {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.isActive) {
    throw new AppError('The selected service is not available.', 400);
  }

  return prisma.serviceRequest.create({
    data: {
      serviceId: input.serviceId,
      citizenId,
      details: input.details,
      status: 'PENDING_PAYMENT',
    },
    include: serviceRequestInclude,
  });
};

interface ListFilters {
  role: AppRole;
  userId: string;
  page: number;
  limit: number;
  skip: number;
  status?: ServiceRequestStatus;
  serviceId?: string;
  sort?: 'newest' | 'oldest';
}

export const listServiceRequests = async (filters: ListFilters) => {
  const where: Prisma.ServiceRequestWhereInput = {};
  if (filters.role === 'CITIZEN') where.citizenId = filters.userId;
  else if (filters.role === 'AGENT') where.assignedAgentId = filters.userId;
  if (filters.status) where.status = filters.status;
  if (filters.serviceId) where.serviceId = filters.serviceId;

  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      include: serviceRequestInclude,
      orderBy: { createdAt: filters.sort === 'oldest' ? 'asc' : 'desc' },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return { requests, total };
};

export const getServiceRequestById = async (
  id: string,
  role: AppRole,
  userId: string
) => {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id },
    include: serviceRequestInclude,
  });
  if (!sr) throw new AppError('Service request not found.', 404);
  assertCanView(sr, role, userId);
  return sr;
};

export const assignServiceRequest = async (
  adminId: string,
  id: string,
  agentId: string
) => {
  const sr = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!sr) throw new AppError('Service request not found.', 404);
  if (sr.status === 'PENDING_PAYMENT') {
    throw new AppError('This request cannot be assigned until it is paid.', 400);
  }
  if (sr.status === 'REJECTED' || sr.status === 'COMPLETED') {
    throw new AppError(`A ${sr.status} request cannot be reassigned.`, 400);
  }

  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent || agent.role !== 'AGENT') {
    throw new AppError('The specified user is not an agent.', 400);
  }
  if (agent.status === 'BANNED') {
    throw new AppError('This agent account is banned and cannot take work.', 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.serviceRequest.update({
      where: { id },
      data: {
        assignedAgentId: agentId,
        status: sr.status === 'PAID' ? 'IN_REVIEW' : sr.status,
      },
      include: serviceRequestInclude,
    });

    await tx.notification.createMany({
      data: [
        {
          userId: agentId,
          type: 'SERVICE',
          message: `You have been assigned a service request (#${id.slice(0, 8)}).`,
        },
        {
          userId: sr.citizenId,
          type: 'SERVICE',
          message: 'Your service request is now being reviewed by an agent.',
        },
      ],
    });

    return updated;
  });
};

export const changeServiceRequestStatus = async (
  actorId: string,
  role: AppRole,
  id: string,
  status: ServiceRequestStatus,
  note?: string
) => {
  const sr = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!sr) throw new AppError('Service request not found.', 404);

  if (role === 'AGENT') {
    if (sr.assignedAgentId !== actorId) {
      throw new AppError('You can only update requests assigned to you.', 403);
    }
    if (!AGENT_ALLOWED_STATUSES.includes(status)) {
      throw new AppError(`Agents cannot set status to ${status}.`, 403);
    }
  }

  if (sr.status === status) {
    throw new AppError(`Service request is already ${status}.`, 400);
  }
  if (!STATUS_TRANSITIONS[sr.status].includes(status)) {
    throw new AppError(`Cannot change status from ${sr.status} to ${status}.`, 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.serviceRequest.update({
      where: { id },
      data: { status },
      include: serviceRequestInclude,
    });

    await tx.notification.create({
      data: {
        userId: sr.citizenId,
        type: 'SERVICE',
        message: note?.trim()
          ? `Your service request is now ${status}: ${note.trim()}`
          : `Your service request is now ${status}.`,
      },
    });

    return updated;
  });
};
