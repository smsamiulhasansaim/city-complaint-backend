import { Prisma, Priority, ComplaintStatus } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';
import { AppRole } from '../utils/jwt';

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
