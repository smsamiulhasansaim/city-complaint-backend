import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';

interface ListFilters {
  userId: string;
  page: number;
  limit: number;
  skip: number;
  isRead?: boolean;
}

export const listNotifications = async (filters: ListFilters) => {
  const where: Prisma.NotificationWhereInput = { userId: filters.userId };
  if (filters.isRead !== undefined) where.isRead = filters.isRead;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: filters.userId, isRead: false } }),
  ]);

  return { notifications, total, unreadCount };
};

export const markRead = async (userId: string, id: string) => {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== userId) {
    throw new AppError('Notification not found.', 404);
  }

  return prisma.notification.update({ where: { id }, data: { isRead: true } });
};

export const markAllRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
};
