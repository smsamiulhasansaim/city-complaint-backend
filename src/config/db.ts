import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton. Cached on globalThis so that serverless (Vercel) cold/warm
 * invocations and nodemon reloads reuse one client instead of exhausting the
 * database connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
