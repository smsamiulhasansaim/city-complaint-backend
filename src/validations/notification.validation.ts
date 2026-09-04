import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    isRead: z.enum(['true', 'false']).optional(),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid notification id') }),
});
