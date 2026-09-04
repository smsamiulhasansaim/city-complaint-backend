import 'dotenv/config';

/**
 * Central, typed access to environment variables with sensible defaults so the
 * app can boot for local dev / offline typecheck even when secrets are absent.
 * Real values are required at runtime for DB, auth, Stripe and Google.
 */
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || '*',

  databaseUrl: process.env.DATABASE_URL || '',

  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  googleClientId: process.env.GOOGLE_CLIENT_ID || '',

  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  expediteFee: Number(process.env.EXPEDITE_FEE) || 20,

  redisUrl: process.env.REDIS_URL || '',

  adminEmail: process.env.ADMIN_EMAIL || 'admin@citycomplaint.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@1234',
};

export default env;
