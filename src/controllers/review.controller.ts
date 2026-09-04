import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import * as reviewService from '../services/review.service';

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.createReview(req.user!.id, req.body);
  sendSuccess(res, 201, 'Review submitted', review);
});

export const getReviewByComplaint = asyncHandler(
  async (req: Request, res: Response) => {
    const review = await reviewService.getReviewByComplaint(req.params.id);
    sendSuccess(res, 200, 'Review fetched', review);
  }
);

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const result = await reviewService.deleteReview(
    req.params.id,
    req.user!.role,
    req.user!.id
  );
  sendSuccess(res, 200, 'Review deleted', result);
});
