import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env';
import apiRoutes from './routes';
import { notFound, errorHandler } from './middleware/errorHandler';
import { sendSuccess } from './utils/sendResponse';
import { setupSwagger } from './config/swagger';

const app: Application = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl === '*' ? true : env.clientUrl.split(','),
    credentials: true,
  })
);
app.use(morgan(env.isProd ? 'combined' : 'dev'));

// The Stripe webhook must receive the raw body for signature verification, so
// it is registered before the JSON parser. body-parser sets `req._body`, so the
// JSON parser below skips this already-parsed request.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Meta / liveness endpoints.
app.get('/', (_req, res) =>
  sendSuccess(res, 200, 'City Complaint & Service Platform API', {
    version: '1.0.0',
    docs: '/api-docs',
    health: '/health',
  })
);
app.get('/health', (_req, res) =>
  sendSuccess(res, 200, 'Service is healthy', {
    status: 'ok',
    uptime: process.uptime(),
  })
);

// API documentation (Swagger UI at /api-docs, raw spec at /api-docs.json).
setupSwagger(app);

app.use('/api', apiRoutes);

// 404 + centralized error handling (must be last).
app.use(notFound);
app.use(errorHandler);

export default app;
