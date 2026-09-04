import { z } from 'zod';

const statusEnum = z.enum([
  'PENDING_PAYMENT',
  'PAID',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
]);

export const createServiceRequestSchema = z.object({
  body: z.object({
    serviceId: z.string().uuid('A valid service id is required'),
    details: z.string().max(2000).optional(),
  }),
});

export const listServiceRequestsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: statusEnum.optional(),
    serviceId: z.string().uuid().optional(),
    sort: z.enum(['newest', 'oldest']).optional(),
  }),
});

export const serviceRequestIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service request id') }),
});

export const assignServiceRequestSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service request id') }),
  body: z.object({ agentId: z.string().uuid('A valid agent id is required') }),
});

export const serviceRequestStatusSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service request id') }),
  body: z.object({
    status: statusEnum,
    note: z.string().max(1000).optional(),
  }),
});
