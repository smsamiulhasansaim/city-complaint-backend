import { z } from 'zod';

const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const statusEnum = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
]);

export const createComplaintSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(150),
    description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
    categoryId: z.string().uuid('A valid category id is required'),
    ward: z.string().max(50).optional(),
    address: z.string().max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    images: z.array(z.string().url('Each image must be a valid URL')).max(10).optional(),
    priority: priorityEnum.optional(),
  }),
});

export const listComplaintsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: statusEnum.optional(),
    categoryId: z.string().uuid().optional(),
    priority: priorityEnum.optional(),
    ward: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
    sort: z.enum(['newest', 'oldest']).optional(),
  }),
});

export const complaintIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid complaint id') }),
});

export const assignComplaintSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid complaint id') }),
  body: z.object({ agentId: z.string().uuid('A valid agent id is required') }),
});

export const complaintStatusSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid complaint id') }),
  body: z.object({
    status: statusEnum,
    note: z.string().max(1000).optional(),
  }),
});

export const addComplaintUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid complaint id') }),
  body: z.object({ note: z.string().min(1, 'A note is required').max(1000) }),
});

export const updateComplaintSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid complaint id') }),
  body: z
    .object({
      title: z.string().min(3).max(150).optional(),
      description: z.string().min(10).max(5000).optional(),
      categoryId: z.string().uuid().optional(),
      ward: z.string().max(50).optional(),
      address: z.string().max(255).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      images: z.array(z.string().url()).max(10).optional(),
      priority: priorityEnum.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'Provide at least one field to update',
    }),
});
