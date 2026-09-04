import Stripe from 'stripe';
import { Prisma, PaymentPurpose } from '@prisma/client';
import prisma from '../config/db';
import stripe from '../config/stripe';
import env from '../config/env';
import AppError from '../utils/AppError';
import { AppRole } from '../utils/jwt';
import { getPagination } from '../utils/pagination';
import { publicUserSelect } from './complaint.service';

/** Stripe wants an absolute URL; fall back to localhost when CLIENT_URL is unset. */
const redirectBase =
  env.clientUrl && env.clientUrl.startsWith('http')
    ? env.clientUrl
    : '';

const paymentInclude = {
  payer: { select: publicUserSelect },
  serviceRequest: { select: { id: true, status: true } },
  complaint: { select: { id: true, title: true, status: true } },
} satisfies Prisma.PaymentInclude;

interface CheckoutParams {
  userId: string;
  amount: number;
  productName: string;
  purpose: PaymentPurpose;
  serviceRequestId?: string;
  complaintId?: string;
}

/**
 * Creates a Stripe Checkout Session and records a PENDING payment. There is at
 * most one payment per service-request/complaint (unique columns), so an
 * unpaid retry reuses that row with a fresh session id.
 */
const buildCheckout = async (params: CheckoutParams) => {
  const existing = params.serviceRequestId
    ? await prisma.payment.findUnique({
        where: { serviceRequestId: params.serviceRequestId },
      })
    : params.complaintId
      ? await prisma.payment.findUnique({ where: { complaintId: params.complaintId } })
      : null;

  if (existing?.status === 'COMPLETED') {
    throw new AppError('This item has already been paid.', 400);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product_data: { name: params.productName },
          unit_amount: Math.round(params.amount * 100),
        },
      },
    ],
    success_url: `${redirectBase}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${redirectBase}/payments/cancel`,
    metadata: {
      purpose: params.purpose,
      userId: params.userId,
      serviceRequestId: params.serviceRequestId ?? '',
      complaintId: params.complaintId ?? '',
    },
  });

  const payment = existing
    ? await prisma.payment.update({
        where: { id: existing.id },
        data: {
          transactionId: session.id,
          amount: params.amount,
          status: 'PENDING',
          paidAt: null,
        },
      })
    : await prisma.payment.create({
        data: {
          transactionId: session.id,
          amount: params.amount,
          currency: 'usd',
          method: 'card',
          provider: 'STRIPE',
          status: 'PENDING',
          purpose: params.purpose,
          payerId: params.userId,
          serviceRequestId: params.serviceRequestId ?? null,
          complaintId: params.complaintId ?? null,
        },
      });

  return { checkoutUrl: session.url, sessionId: session.id, payment };
};

/**
 * Idempotent fulfillment shared by the confirm endpoint and the webhook. Marks
 * the payment COMPLETED and advances the linked entity in one transaction.
 */
export const fulfillPaidSession = async (session: Stripe.Checkout.Session) => {
  if (session.payment_status !== 'paid') return null;

  const payment = await prisma.payment.findUnique({
    where: { transactionId: session.id },
  });
  if (!payment) return null;
  if (payment.status === 'COMPLETED') return payment;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED', paidAt: new Date() },
    });

    if (payment.purpose === 'SERVICE_REQUEST' && payment.serviceRequestId) {
      const sr = await tx.serviceRequest.findUnique({
        where: { id: payment.serviceRequestId },
      });
      if (sr && sr.status === 'PENDING_PAYMENT') {
        await tx.serviceRequest.update({
          where: { id: sr.id },
          data: { status: 'PAID' },
        });
      }
      await tx.notification.create({
        data: {
          userId: payment.payerId,
          type: 'PAYMENT',
          message: 'Payment received — your service request has been submitted.',
        },
      });
    } else if (payment.purpose === 'COMPLAINT_EXPEDITE' && payment.complaintId) {
      await tx.complaint.update({
        where: { id: payment.complaintId },
        data: { isExpedited: true, priority: 'URGENT' },
      });
      await tx.notification.create({
        data: {
          userId: payment.payerId,
          type: 'PAYMENT',
          message: 'Payment received — your complaint has been marked URGENT.',
        },
      });
    }

    return updated;
  });
};

export const createServiceRequestCheckout = async (
  userId: string,
  serviceRequestId: string
) => {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: { service: true },
  });
  if (!sr) throw new AppError('Service request not found.', 404);
  if (sr.citizenId !== userId) {
    throw new AppError('You can only pay for your own service requests.', 403);
  }
  if (sr.status !== 'PENDING_PAYMENT') {
    throw new AppError('This service request is not awaiting payment.', 400);
  }

  return buildCheckout({
    userId,
    amount: Number(sr.service.fee),
    productName: `Municipal service: ${sr.service.name}`,
    purpose: 'SERVICE_REQUEST',
    serviceRequestId,
  });
};

export const createComplaintExpediteCheckout = async (
  userId: string,
  complaintId: string
) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw new AppError('Complaint not found.', 404);
  if (complaint.citizenId !== userId) {
    throw new AppError('You can only expedite your own complaints.', 403);
  }
  if (complaint.isExpedited) {
    throw new AppError('This complaint has already been expedited.', 400);
  }
  if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(complaint.status)) {
    throw new AppError('This complaint can no longer be expedited.', 400);
  }

  return buildCheckout({
    userId,
    amount: env.expediteFee,
    productName: `Expedite complaint: ${complaint.title}`,
    purpose: 'COMPLAINT_EXPEDITE',
    complaintId,
  });
};

export const confirmPayment = async (
  userId: string,
  role: AppRole,
  sessionId: string
) => {  const payment = await prisma.payment.findUnique({
    where: { transactionId: sessionId },
  });
  if (!payment) throw new AppError('No payment found for this session.', 404);
  if (role !== 'ADMIN' && payment.payerId !== userId) {
    throw new AppError('You cannot confirm a payment you did not initiate.', 403);
  }
  if (payment.status === 'COMPLETED') {
    return { payment, alreadyConfirmed: true };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    throw new AppError('Could not retrieve this Stripe session.', 400);
  }

  if (session.payment_status !== 'paid') {
    throw new AppError('This payment has not been completed in Stripe yet.', 400);
  }

  const updated = await fulfillPaidSession(session);
  return { payment: updated ?? payment, alreadyConfirmed: false };
};

interface ListFilters {
  role: AppRole;
  userId: string;
  query: Record<string, unknown>;
  status?: string;
  purpose?: string;
}

export const listPayments = async (filters: ListFilters) => {
  const { page, limit, skip } = getPagination(filters.query);
  const where: Prisma.PaymentWhereInput = {};
  if (filters.role !== 'ADMIN') where.payerId = filters.userId;
  if (filters.status) where.status = filters.status as Prisma.EnumPaymentStatusFilter['equals'];
  if (filters.purpose)
    where.purpose = filters.purpose as Prisma.EnumPaymentPurposeFilter['equals'];

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, total, page, limit };
};

export const getPaymentById = async (id: string, role: AppRole, userId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: paymentInclude,
  });
  if (!payment) throw new AppError('Payment not found.', 404);
  if (role !== 'ADMIN' && payment.payerId !== userId) {
    throw new AppError('You do not have permission to view this payment.', 403);
  }
  return payment;
};

/**
 * Verifies a Stripe webhook signature against the raw request body. Throws if
 * the secret is unset or the signature is invalid.
 */
export const constructWebhookEvent = (
  rawBody: Buffer,
  signature: string
): Stripe.Event => {
  if (!env.stripeWebhookSecret) {
    throw new AppError('Stripe webhook secret is not configured.', 500);
  }
  return stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
};

/** Fulfils checkout.session.completed events (redundant, reliable backup path). */
export const handleWebhookEvent = async (event: Stripe.Event): Promise<void> => {
  if (event.type === 'checkout.session.completed') {
    await fulfillPaidSession(event.data.object as Stripe.Checkout.Session);
  }
};
