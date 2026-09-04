import { z } from 'zod';

const roleEnum = z.enum(['CITIZEN', 'AGENT', 'ADMIN']);
const statusEnum = z.enum(['ACTIVE', 'BANNED']);

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    role: roleEnum.optional(),
    status: statusEnum.optional(),
    search: z.string().trim().min(1).optional(),
  }),
});

export const userIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid user id') }),
});

export const createAgentSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email('A valid email is required'),
    password: z.string().min(6).max(100),
    phone: z.string().min(6).max(20).optional(),
    ward: z.string().max(50).optional(),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid user id') }),
  body: z.object({ role: roleEnum }),
});

export const updateStatusSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid user id') }),
  body: z.object({ status: statusEnum }),
});
