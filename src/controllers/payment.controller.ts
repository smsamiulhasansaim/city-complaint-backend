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

export const expediteComplaint = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.createComplaintExpediteCheckout(
    req.user!.id,
    req.params.id
  );
  sendSuccess(res, 201, 'Expedite checkout session created', result);
});

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

/**
 * Stripe webhook. Mounted with a raw body parser (see app.ts) so the signature
 * can be verified. Returns Stripe's expected 200 ack rather than our envelope.
 */
export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string | undefined;
  if (!signature) {
    res.status(400).json({ success: false, message: 'Missing Stripe signature', errors: [] });
    return;
  }

  let event;
  try {
    event = paymentService.constructWebhookEvent(req.body as Buffer, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook verification failed';
    res.status(400).json({ success: false, message, errors: [] });
    return;
  }

  await paymentService.handleWebhookEvent(event);
  res.status(200).json({ received: true });
});
