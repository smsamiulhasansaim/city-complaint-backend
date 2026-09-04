import { Router } from 'express';
import * as reviewController from '../controllers/review.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createReviewSchema,
  complaintIdParamSchema,
  reviewIdSchema,
} from '../validations/review.validation';

const router = Router();

// Public: read the review for a given complaint (civic transparency).
router.get(
  '/complaint/:id',
  validate(complaintIdParamSchema),
  reviewController.getReviewByComplaint
);

router.post(
  '/',
  authenticate,
  authorize('CITIZEN'),
  validate(createReviewSchema),
  reviewController.createReview
);

router.delete(
  '/:id',
  authenticate,
  validate(reviewIdSchema),
  reviewController.deleteReview
);

export default router;
