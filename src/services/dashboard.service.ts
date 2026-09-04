import prisma from '../config/db';
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from '../utils/cache';
import { complaintInclude } from './complaint.service';

/** Collapse a Prisma groupBy result into a `{ value: count }` map. */
const countBy = <R extends { _count: { _all: number } }>(
  rows: R[],
  pick: (row: R) => string
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const row of rows) out[pick(row)] = row._count._all;
  return out;
};

export const getAdminDashboard = async () => {
  const cached = await cacheGet(CacheKeys.adminDashboard);
  if (cached) return cached;

  const [
    usersByRole,
    complaintsByStatus,
    complaintsByPriority,
    srByStatus,
    revenueAgg,
    totalComplaints,
    totalServiceRequests,
    paidCount,
    recentComplaints,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.serviceRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
    prisma.complaint.count(),
    prisma.serviceRequest.count(),
    prisma.payment.count({ where: { status: 'COMPLETED' } }),
    prisma.complaint.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: complaintInclude,
    }),
  ]);

  const data = {
    users: {
      total: usersByRole.reduce((sum, r) => sum + r._count._all, 0),
      byRole: countBy(usersByRole, (r) => r.role),
    },
    complaints: {
      total: totalComplaints,
      byStatus: countBy(complaintsByStatus, (r) => r.status),
      byPriority: countBy(complaintsByPriority, (r) => r.priority),
    },
    serviceRequests: {
      total: totalServiceRequests,
      byStatus: countBy(srByStatus, (r) => r.status),
    },
    revenue: {
      currency: 'usd',
      totalCollected: Number(revenueAgg._sum.amount ?? 0),
      paidCount,
    },
    recentComplaints,
  };

  await cacheSet(CacheKeys.adminDashboard, data, CacheTTL.dashboard);
  return data;
};

export const getAgentDashboard = async (agentId: string) => {
  const [totalAssigned, complaintsByStatus, srAssigned, srByStatus, resolved] =
    await Promise.all([
      prisma.complaint.count({ where: { assignedAgentId: agentId } }),
      prisma.complaint.groupBy({
        by: ['status'],
        where: { assignedAgentId: agentId },
        _count: { _all: true },
      }),
      prisma.serviceRequest.count({ where: { assignedAgentId: agentId } }),
      prisma.serviceRequest.groupBy({
        by: ['status'],
        where: { assignedAgentId: agentId },
        _count: { _all: true },
      }),
      prisma.complaint.count({
        where: { assignedAgentId: agentId, status: { in: ['RESOLVED', 'CLOSED'] } },
      }),
    ]);

  return {
    complaints: {
      totalAssigned,
      resolved,
      byStatus: countBy(complaintsByStatus, (r) => r.status),
    },
    serviceRequests: {
      totalAssigned: srAssigned,
      byStatus: countBy(srByStatus, (r) => r.status),
    },
  };
};

export const getCitizenDashboard = async (userId: string) => {
  const [totalComplaints, complaintsByStatus, totalSr, srByStatus, spentAgg, unread] =
    await Promise.all([
      prisma.complaint.count({ where: { citizenId: userId } }),
      prisma.complaint.groupBy({
        by: ['status'],
        where: { citizenId: userId },
        _count: { _all: true },
      }),
      prisma.serviceRequest.count({ where: { citizenId: userId } }),
      prisma.serviceRequest.groupBy({
        by: ['status'],
        where: { citizenId: userId },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { payerId: userId, status: 'COMPLETED' },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

  return {
    complaints: {
      total: totalComplaints,
      byStatus: countBy(complaintsByStatus, (r) => r.status),
    },
    serviceRequests: {
      total: totalSr,
      byStatus: countBy(srByStatus, (r) => r.status),
    },
    totalSpent: Number(spentAgg._sum.amount ?? 0),
    unreadNotifications: unread,
  };
};
