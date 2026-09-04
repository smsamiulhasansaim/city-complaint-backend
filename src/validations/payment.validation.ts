import { z } from 'zod';

const statusEnum = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);
const purposeEnum = z.enum(['SERVICE_REQUEST', 'COMPLAINT_EXPEDITE']);

export const serviceRequestCheckoutSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service request id') }),
});

export const complaintExpediteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid complaint id') }),
});

export const confirmPaymentSchema = z.object({
  body: z.object({ sessionId: z.string().min(3, 'A Stripe session id is required') }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: statusEnum.optional(),
    purpose: purposeEnum.optional(),
  }),
});

export const paymentIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid payment id') }),
});
