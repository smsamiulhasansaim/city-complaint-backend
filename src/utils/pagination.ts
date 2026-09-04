import { Meta } from './sendResponse';

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Normalizes `page`/`limit` query strings into safe numbers (limit capped at
 * 100) plus the Prisma `skip` offset.
 */
export const getPagination = (query: {
  page?: unknown;
  limit?: unknown;
}): Pagination => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const buildMeta = (total: number, page: number, limit: number): Meta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});
