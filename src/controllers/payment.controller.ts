import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import { buildMeta } from '../utils/pagination';
import * as paymentService from '../services/payment.service';

export const checkoutServiceRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await paymentService.createServiceRequestCheckout(
      req.user!.id,
      req.params.id
    );
    sendSuccess(res, 201, 'Checkout session created', result);
  }
);

export const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.confirmPayment(
    req.user!.id,
    req.user!.role,
    req.body.sessionId
  );
  sendSuccess(res, 200, 'Payment confirmed', result);
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const { status, purpose } = req.query as Record<string, string | undefined>;
  const { payments, total, page, limit } = await paymentService.listPayments({
    role: req.user!.role,
    userId: req.user!.id,
    query: req.query,
    status,
    purpose,
  });
  sendSuccess(res, 200, 'Payments fetched', payments, buildMeta(total, page, limit));
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.getPaymentById(
    req.params.id,
    req.user!.role,
    req.user!.id
  );
  sendSuccess(res, 200, 'Payment fetched', payment);
});
