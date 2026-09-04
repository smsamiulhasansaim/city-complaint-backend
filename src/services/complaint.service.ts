import { Prisma, Priority, ComplaintStatus } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';
import { AppRole } from '../utils/jwt';

/** Statuses an agent is allowed to move their assigned complaint into. */
const AGENT_ALLOWED_STATUSES: ComplaintStatus[] = [
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
];

/** Permitted status transitions (applies to admins and agents alike). */
const STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  PENDING: ['ASSIGNED', 'REJECTED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'REJECTED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

/** Minimal user projection embedded in complaint payloads. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  ward: true,
} satisfies Prisma.UserSelect;

export const complaintInclude = {
  category: { select: { id: true, name: true } },
  citizen: { select: publicUserSelect },
  assignedAgent: { select: publicUserSelect },
  _count: { select: { updates: true } },
} satisfies Prisma.ComplaintInclude;

/** Citizens see their own; agents see assigned; admins see everything. */
export const assertCanViewComplaint = (
  complaint: { citizenId: string; assignedAgentId: string | null },
  role: AppRole,
  userId: string
): void => {
  if (role === 'ADMIN') return;
  if (role === 'CITIZEN' && complaint.citizenId === userId) return;
  if (role === 'AGENT' && complaint.assignedAgentId === userId) return;
  throw new AppError('You do not have permission to view this complaint.', 403);
};

interface CreateInput {
  title: string;
  description: string;
  categoryId: string;
  ward?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  priority?: Priority;
}

export const createComplaint = async (citizenId: string, input: CreateInput) => {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
  });
  if (!category || !category.isActive) {
    throw new AppError('The selected category is not available.', 400);
  }

  return prisma.complaint.create({
    data: {
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      ward: input.ward,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      images: input.images ?? [],
      priority: input.priority ?? 'MEDIUM',
      citizenId,
    },
    include: complaintInclude,
  });
};

interface ListFilters {
  role: AppRole;
  userId: string;
  page: number;
  limit: number;
  skip: number;
  status?: ComplaintStatus;
  categoryId?: string;
  priority?: Priority;
  ward?: string;
  search?: string;
  sort?: 'newest' | 'oldest';
}

export const listComplaints = async (filters: ListFilters) => {
  const where: Prisma.ComplaintWhereInput = {};

  // Role scoping.
  if (filters.role === 'CITIZEN') where.citizenId = filters.userId;
  else if (filters.role === 'AGENT') where.assignedAgentId = filters.userId;

  if (filters.status) where.status = filters.status;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.priority) where.priority = filters.priority;
  if (filters.ward) where.ward = { equals: filters.ward, mode: 'insensitive' };
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [complaints, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: complaintInclude,
      orderBy: { createdAt: filters.sort === 'oldest' ? 'asc' : 'desc' },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.complaint.count({ where }),
  ]);

  return { complaints, total };
};

export const getComplaintById = async (id: string, role: AppRole, userId: string) => {
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { ...complaintInclude, review: true },
  });
  if (!complaint) throw new AppError('Complaint not found.', 404);
  assertCanViewComplaint(complaint, role, userId);
  return complaint;
};

type UpdateInput = Partial<CreateInput>;

export const updateComplaint = async (
  id: string,
  userId: string,
  data: UpdateInput
) => {
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw new AppError('Complaint not found.', 404);
  if (complaint.citizenId !== userId) {
    throw new AppError('Only the owner can edit this complaint.', 403);
  }
  if (complaint.status !== 'PENDING') {
    throw new AppError('Only complaints that are still pending can be edited.', 400);
  }
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || !category.isActive) {
      throw new AppError('The selected category is not available.', 400);
    }
  }

  return prisma.complaint.update({
    where: { id },
    data,
    include: complaintInclude,
  });
};

export const deleteComplaint = async (id: string, role: AppRole, userId: string) => {
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw new AppError('Complaint not found.', 404);

  if (role !== 'ADMIN') {
    if (complaint.citizenId !== userId) {
      throw new AppError('Only the owner can delete this complaint.', 403);
    }
    if (complaint.status !== 'PENDING') {
      throw new AppError('Only pending complaints can be deleted.', 400);
    }
  }

  const payment = await prisma.payment.findUnique({ where: { complaintId: id } });
  if (payment) {
    throw new AppError(
      'This complaint has a linked payment record and cannot be deleted.',
      409
    );
  }

  await prisma.complaint.delete({ where: { id } });
  return { deleted: true };
};

/**
 * Admin assigns a complaint to an agent. Runs in a transaction so the status
 * change, the audit-trail entry and both notifications either all land or none.
 */
export const assignComplaint = async (
  adminId: string,
  complaintId: string,
  agentId: string
) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw new AppError('Complaint not found.', 404);

  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent || agent.role !== 'AGENT') {
    throw new AppError('The specified user is not an agent.', 400);
  }
  if (agent.status === 'BANNED') {
    throw new AppError('This agent account is banned and cannot take work.', 400);
  }

  const fromStatus = complaint.status;
  const toStatus: ComplaintStatus =
    fromStatus === 'PENDING' ? 'ASSIGNED' : fromStatus;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.complaint.update({
      where: { id: complaintId },
      data: { assignedAgentId: agentId, status: toStatus },
      include: complaintInclude,
    });

    await tx.complaintUpdate.create({
      data: {
        complaintId,
        authorId: adminId,
        fromStatus,
        toStatus,
        note: `Assigned to agent ${agent.name}.`,
      },
    });

    await tx.notification.createMany({
      data: [
        {
          userId: agentId,
          type: 'COMPLAINT',
          message: `You have been assigned a complaint: "${complaint.title}".`,
        },
        {
          userId: complaint.citizenId,
          type: 'COMPLAINT',
          message: `Your complaint "${complaint.title}" has been assigned to an agent.`,
        },
      ],
    });

    return updated;
  });
};

/**
 * Agent (on their own complaint) or admin advances a complaint's status.
 * Transaction: update + audit entry + notification, plus resolvedAt bookkeeping.
 */
export const changeComplaintStatus = async (
  actorId: string,
  role: AppRole,
  complaintId: string,
  status: ComplaintStatus,
  note?: string
) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw new AppError('Complaint not found.', 404);

  if (role === 'AGENT') {
    if (complaint.assignedAgentId !== actorId) {
      throw new AppError('You can only update complaints assigned to you.', 403);
    }
    if (!AGENT_ALLOWED_STATUSES.includes(status)) {
      throw new AppError(`Agents cannot set status to ${status}.`, 403);
    }
  }

  const fromStatus = complaint.status;
  if (fromStatus === status) {
    throw new AppError(`Complaint is already ${status}.`, 400);
  }
  if (!STATUS_TRANSITIONS[fromStatus].includes(status)) {
    throw new AppError(`Cannot change status from ${fromStatus} to ${status}.`, 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.complaint.update({
      where: { id: complaintId },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : complaint.resolvedAt,
      },
      include: complaintInclude,
    });

    await tx.complaintUpdate.create({
      data: {
        complaintId,
        authorId: actorId,
        fromStatus,
        toStatus: status,
        note: note?.trim() || `Status changed from ${fromStatus} to ${status}.`,
      },
    });

    await tx.notification.create({
      data: {
        userId: complaint.citizenId,
        type: 'COMPLAINT',
        message: `Your complaint "${complaint.title}" is now ${status}.`,
      },
    });

    return updated;
  });
};

/** A free-form note on the complaint timeline (citizen, assigned agent or admin). */
export const addComplaintUpdate = async (
  actorId: string,
  role: AppRole,
  complaintId: string,
  note: string
) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw new AppError('Complaint not found.', 404);

  const isOwner = complaint.citizenId === actorId;
  const isAssignedAgent = complaint.assignedAgentId === actorId;
  if (role !== 'ADMIN' && !isOwner && !isAssignedAgent) {
    throw new AppError('You do not have permission to comment on this complaint.', 403);
  }

  return prisma.$transaction(async (tx) => {
    const update = await tx.complaintUpdate.create({
      data: { complaintId, authorId: actorId, note },
      include: { author: { select: publicUserSelect } },
    });

    // Notify the other party in the conversation.
    const recipientId = isOwner ? complaint.assignedAgentId : complaint.citizenId;
    if (recipientId && recipientId !== actorId) {
      await tx.notification.create({
        data: {
          userId: recipientId,
          type: 'COMPLAINT',
          message: `New update on complaint "${complaint.title}".`,
        },
      });
    }

    return update;
  });
};

export const listComplaintUpdates = async (
  complaintId: string,
  role: AppRole,
  userId: string
) => {
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: { citizenId: true, assignedAgentId: true },
  });
  if (!complaint) throw new AppError('Complaint not found.', 404);
  assertCanViewComplaint(complaint, role, userId);

  return prisma.complaintUpdate.findMany({
    where: { complaintId },
    include: { author: { select: publicUserSelect } },
    orderBy: { createdAt: 'asc' },
  });
};
