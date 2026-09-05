import Stripe from 'stripe';
import env from './env';

/**
 * Stripe client. A placeholder key is used when STRIPE_SECRET_KEY is absent so
 * that importing this module never crashes app startup; only the actual payment
 * endpoints will fail (with a clear Stripe error) until a real test key is set.
 */
const stripe = new Stripe(env.stripeSecretKey || '', {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
});

export default stripe;
