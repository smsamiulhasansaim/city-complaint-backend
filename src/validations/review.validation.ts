import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    complaintId: z.string().uuid('A valid complaint id is required'),
    rating: z
      .number({ invalid_type_error: 'Rating must be a number' })
      .int()
      .min(1, 'Rating must be between 1 and 5')
      .max(5, 'Rating must be between 1 and 5'),
    comment: z.string().min(1, 'A comment is required').max(1000),
  }),
});

export const complaintIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid complaint id') }),
});

export const reviewIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid review id') }),
});
