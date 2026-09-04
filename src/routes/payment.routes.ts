import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  serviceRequestCheckoutSchema,
  confirmPaymentSchema,
  listPaymentsSchema,
  paymentIdSchema,
} from '../validations/payment.validation';

const router = Router();

// Start a Stripe Checkout Session for a paid service request.
router.post(
  '/service-requests/:id/checkout',
  authenticate,
  authorize('CITIZEN'),
  validate(serviceRequestCheckoutSchema),
  paymentController.checkoutServiceRequest
);

// Verify a session and fulfil it (primary confirmation path).
router.post(
  '/confirm',
  authenticate,
  validate(confirmPaymentSchema),
  paymentController.confirmPayment
);

router.get('/', authenticate, validate(listPaymentsSchema), paymentController.listPayments);
router.get('/:id', authenticate, validate(paymentIdSchema), paymentController.getPayment);

export default router;
