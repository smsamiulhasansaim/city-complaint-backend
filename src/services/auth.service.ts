import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';
import { signToken } from '../utils/jwt';

/** Columns safe to return to clients — never includes the password hash. */
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  address: true,
  ward: true,
  avatar: true,
  authProvider: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const BCRYPT_COST = 10;
export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_COST);

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  ward?: string;
}

export const registerCitizen = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const password = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password,
      phone: input.phone,
      address: input.address,
      ward: input.ward,
      role: 'CITIZEN',
      authProvider: 'LOCAL',
    },
    select: userSelect,
  });

  const token = signToken({ id: user.id, role: user.role });
  return { user, token };
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }
  if (user.status === 'BANNED') {
    throw new AppError('Your account has been banned. Contact support.', 403);
  }
  if (!user.password) {
    throw new AppError(
      'This account uses Google sign-in. Please continue with Google.',
      400
    );
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = signToken({ id: user.id, role: user.role });
  const { password: _pw, ...safe } = user;
  return { user: safe, token };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
  if (!user) throw new AppError('User not found.', 404);
  return user;
};

interface UpdateMeInput {
  name?: string;
  phone?: string;
  address?: string;
  ward?: string;
  avatar?: string;
}

export const updateMe = async (userId: string, data: UpdateMeInput) => {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: userSelect,
  });
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);
  if (!user.password) {
    throw new AppError(
      'This account uses Google sign-in and has no password to change.',
      400
    );
  }

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new AppError('Current password is incorrect.', 401);

  const password = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password } });
  return { updated: true };
};
