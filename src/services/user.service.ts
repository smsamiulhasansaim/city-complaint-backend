import { Prisma, Role, UserStatus } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';
import { userSelect, hashPassword } from './auth.service';

interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  role?: Role;
  status?: UserStatus;
  search?: string;
}

export const listUsers = async (filters: ListFilters) => {
  const where: Prisma.UserWhereInput = {};
  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw new AppError('User not found.', 404);
  return user;
};

interface CreateAgentInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  ward?: string;
}

export const createAgent = async (input: CreateAgentInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const password = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password,
      phone: input.phone,
      ward: input.ward,
      role: 'AGENT',
      authProvider: 'LOCAL',
    },
    select: userSelect,
  });
};

export const updateRole = async (actorId: string, id: string, role: Role) => {
  if (actorId === id) {
    throw new AppError('You cannot change your own role.', 400);
  }
  await getUserById(id); // 404 if missing
  return prisma.user.update({ where: { id }, data: { role }, select: userSelect });
};

export const updateStatus = async (actorId: string, id: string, status: UserStatus) => {
  if (actorId === id) {
    throw new AppError('You cannot change your own account status.', 400);
  }
  await getUserById(id);
  return prisma.user.update({ where: { id }, data: { status }, select: userSelect });
};

export const deleteUser = async (actorId: string, id: string) => {
  if (actorId === id) {
    throw new AppError('You cannot delete your own account.', 400);
  }
  await getUserById(id);

  // Users are referenced by complaints/requests/payments without cascade, so a
  // hard delete would violate FK constraints. Guide the admin to ban instead.
  const [complaints, requests, payments, assigned] = await Promise.all([
    prisma.complaint.count({ where: { citizenId: id } }),
    prisma.serviceRequest.count({ where: { citizenId: id } }),
    prisma.payment.count({ where: { payerId: id } }),
    prisma.complaint.count({ where: { assignedAgentId: id } }),
  ]);

  if (complaints + requests + payments + assigned > 0) {
    throw new AppError(
      'This user has activity on the platform and cannot be deleted. Ban the account instead.',
      409
    );
  }

  await prisma.user.delete({ where: { id } });
  return { deleted: true };
};
