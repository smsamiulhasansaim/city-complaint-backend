import { Response } from 'express';

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard success envelope required by the assignment:
 *   { success: true, message, data, meta? }
 */
export const sendSuccess = (
  res: Response,
  statusCode: number,
  message: string,
  data: unknown = null,
  meta?: Meta
): Response => {
  const body: Record<string, unknown> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};
