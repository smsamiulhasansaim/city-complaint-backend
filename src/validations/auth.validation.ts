import { z } from 'zod';

/** Registration is CITIZEN-only; agents/admins are provisioned by an admin. */
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('A valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
    phone: z.string().min(6).max(20).optional(),
    address: z.string().max(255).optional(),
    ward: z.string().max(50).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('A valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const googleSchema = z.object({
  body: z.object({
    code: z.string().min(10, 'A Google authorization code is required'),
    redirectUri: z.string().optional(),
  }),
});

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(6).max(20).optional(),
    address: z.string().max(255).optional(),
    ward: z.string().max(50).optional(),
    avatar: z.string().url('Avatar must be a valid URL').optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
  }),
});
