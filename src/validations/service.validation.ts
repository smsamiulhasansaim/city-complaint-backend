import { z } from 'zod';

export const serviceIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service id') }),
});

export const createServiceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    description: z.string().min(2).max(1000),
    fee: z.number({ invalid_type_error: 'Fee must be a number' }).nonnegative().max(1_000_000),
    isActive: z.boolean().optional(),
  }),
});

export const updateServiceSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service id') }),
  body: z
    .object({
      name: z.string().min(2).max(100).optional(),
      description: z.string().min(2).max(1000).optional(),
      fee: z.number().nonnegative().max(1_000_000).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'Provide at least one field to update',
    }),
});
