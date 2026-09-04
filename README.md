# City Complaint & Service Platform — Backend API

A production-grade RESTful API for a municipal platform where **citizens** file civic complaints and request **paid municipal services**, **field agents** resolve assigned work, and **admins** oversee everything.

Built with TypeScript, Express, Prisma (PostgreSQL), JWT + Google auth, real Stripe payments, Zod validation, Redis caching, and Swagger docs. Deployable to Vercel as a serverless function.

> **Assignment:** Programming Hero B7A6 — *City Complaint & Service Platform* (backend only).

- **Live API:** `<your-vercel-url>` (set after deploy)
- **Swagger UI:** `<your-vercel-url>/api-docs` · **Raw spec:** `/api-docs.json`
- **Postman:** [`CityComplaint.postman_collection.json`](./CityComplaint.postman_collection.json) (repo root)

---

## Table of contents
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Roles & permissions](#roles--permissions)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [API overview](#api-overview)
- [Response format](#response-format)
- [Payments (Stripe)](#payments-stripe)
- [Caching (Redis)](#caching-redis)
- [Deployment (Vercel)](#deployment-vercel)
- [Demo credentials](#demo-credentials)

---

## Features

- **3-role RBAC** — `CITIZEN`, `AGENT`, `ADMIN`, enforced per route.
- **Authentication** — email/password (bcrypt) **and** Google (GCP) social login, both issuing the app's own JWT.
- **Complaints** — full lifecycle: file → assign → in-progress → resolved/rejected, with a status **timeline** and notifications.
- **Paid services** — service catalog + service requests gated behind **real Stripe** checkout.
- **Complaint expedite** — pay a fixed fee to bump a complaint to `URGENT`.
- **Reviews** — citizens rate resolved complaints (one review each).
- **Notifications** — per-user feed with unread counts.
- **Dashboards** — role-scoped statistics (admin/agent/citizen).
- **Validation** — Zod on every applicable endpoint → `422` with field-level errors.
- **Transactions** — Prisma `$transaction` for assign, status change, and payment fulfilment (atomic writes + audit log + notifications).
- **Caching** — Redis cache-aside for categories, services and the admin dashboard (best-effort; app runs fine without Redis).
- **Docs** — Swagger UI + committed Postman collection.
- **Serverless-ready** — Prisma/Redis singletons, `export default app`, Vercel config.

## Tech stack

| Area | Choice |
| --- | --- |
| Language / runtime | TypeScript, Node.js |
| Framework | Express 4 |
| ORM / DB | Prisma 5 · PostgreSQL |
| Auth | jsonwebtoken (JWT HS256), bcryptjs, google-auth-library |
| Payments | Stripe (Checkout Sessions + webhook) |
| Validation | Zod |
| Caching | ioredis (Redis) |
| Docs | swagger-ui-express + swagger-jsdoc |
| Security / logs | helmet, cors, morgan |

## Architecture

Layered request flow — **Routes → Controllers → Services → Prisma**. Controllers stay thin; all business logic, Prisma access, transactions and caching live in services.

```
src/
  app.ts              # builds & exports the Express app (no listen)
  index.ts            # local: app.listen; also `export default app` for Vercel
  config/             # env, db (Prisma singleton), redis, stripe, swagger
  middleware/         # auth (authenticate/authorize), validate (Zod), errorHandler
  utils/              # AppError, asyncHandler, jwt, sendResponse, cache, pagination
  routes/             # <feature>.routes.ts + index.ts aggregator
  controllers/        # <feature>.controller.ts
  services/           # <feature>.service.ts (logic, Prisma, $transaction, cache)
  validations/        # <feature>.validation.ts (Zod schemas)
prisma/               # schema/ (per-domain .prisma files), seed.ts
vercel.json  .env.example  CityComplaint.postman_collection.json
```

## Data model

Core entities and relationships (see the [`prisma/schema/`](./prisma/schema) folder — split per domain):

- **User** — `role` (CITIZEN/AGENT/ADMIN), `status` (ACTIVE/BANNED), `authProvider` (LOCAL/GOOGLE). Owns complaints, service requests, payments, reviews, notifications; agents own assigned work.
- **Category** — complaint categories (unique name, soft-disable via `isActive`).
- **Complaint** — `title`, `description`, `priority`, `status`, `isExpedited`, geo/ward, images; belongs to a citizen, a category, and optionally an assigned agent. Has a **ComplaintUpdate** timeline, an optional **Review**, and an optional **Payment** (expedite).
- **Service** — paid service catalog (`fee` as `Decimal(10,2)`).
- **ServiceRequest** — a citizen's request for a service; status flows `PENDING_PAYMENT → PAID → IN_REVIEW → APPROVED/REJECTED → COMPLETED`.
- **Payment** — Stripe-backed; `transactionId` (session id) unique; linked to **exactly one** of a service request or a complaint (expedite).
- **Review**, **Notification** — feedback and per-user alerts.

Indexes on hot filter columns (status, category, citizen, agent, priority, createdAt) and unique constraints on emails, names, `transactionId`, one-payment-per-entity, one-review-per-complaint.

## Roles & permissions

| Capability | CITIZEN | AGENT | ADMIN |
| --- | :---: | :---: | :---: |
| Register / login / Google login | ✅ | ✅ | ✅ |
| File / edit own (pending) / delete own complaint | ✅ | — | — |
| View complaints | own | assigned | all |
| Assign complaint to agent | — | — | ✅ |
| Change complaint status | — | ✅ (assigned) | ✅ |
| Create service request & pay | ✅ | — | — |
| Assign / progress service request | — | ✅ (assigned) | ✅ |
| Expedite own complaint (pay) | ✅ | — | — |
| Review resolved complaint | ✅ | — | — |
| Manage categories / services | — | — | ✅ |
| Manage users (create agents, roles, ban) | — | — | ✅ |
| Dashboards | citizen | agent | admin |

Unauthenticated → `401`; wrong role → `403`.

## Getting started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local, or **[Neon](https://neon.tech)** for serverless/Vercel)
- Optional: a Redis instance (e.g. **[Upstash](https://upstash.com)**) — the app runs without it
- A Stripe account (**test mode** is fine)
- A Google OAuth 2.0 **Client ID** (only needed to exercise Google login)

### Setup

```bash
# 1. Install dependencies (runs `prisma generate` via postinstall)
npm install

# 2. Create your .env from the template and fill in the values
cp .env.example .env

# 3. Create the schema in your database
npm run prisma:migrate      # dev: creates a migration + applies it

# 4. Seed demo data (admin, agents, citizens, categories, services, samples)
npm run prisma:seed

# 5. Run the dev server (http://localhost:5000)
npm run dev
```

Then open **http://localhost:5000/api-docs** for Swagger, or import the Postman collection.

## Environment variables

All variables are documented in [`.env.example`](./.env.example):

| Variable | Required | Notes |
| --- | :---: | --- |
| `PORT` | — | Defaults to `5000` |
| `NODE_ENV` | — | `development` / `production` |
| `CLIENT_URL` | — | CORS origins (comma-separated); defaults to `*` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Long random string |
| `JWT_EXPIRES_IN` | — | Defaults to `7d` |
| `GOOGLE_CLIENT_ID` | for Google login | OAuth 2.0 Web client ID |
| `STRIPE_SECRET_KEY` | for payments | Use `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | for webhook | `whsec_...` from Stripe CLI/dashboard |
| `EXPEDITE_FEE` | — | Fixed expedite fee; defaults to `20` |
| `REDIS_URL` | — | Enables caching if set |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Seeded admin; defaults documented below |

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start with nodemon + ts-node |
| `npm run build` | `prisma generate && tsc` → `dist/` |
| `npm start` | Run compiled `dist/index.js` |
| `npm run prisma:migrate` | `prisma migrate dev` (local) |
| `npm run prisma:deploy` | `prisma migrate deploy` (prod/CI) |
| `npm run prisma:seed` | Seed the database (idempotent) |
| `npm run prisma:studio` | Open Prisma Studio |

## API overview

Base path: `/api`. Full request/response detail is in **Swagger** (`/api-docs`) and the **Postman collection**.

| Group | Endpoints |
| --- | --- |
| **Auth** `/auth` | `POST /register` · `POST /login` · `POST /google` · `GET /me` · `PATCH /me` · `PATCH /me/password` |
| **Users** `/users` (admin) | `GET /` · `POST /agents` · `GET /:id` · `PATCH /:id/role` · `PATCH /:id/status` · `DELETE /:id` |
| **Categories** `/categories` | `GET /` · `GET /:id` (public) · `POST /` · `PATCH /:id` · `DELETE /:id` (admin) |
| **Services** `/services` | `GET /` · `GET /:id` (public) · `POST /` · `PATCH /:id` · `DELETE /:id` (admin) |
| **Complaints** `/complaints` | `POST /` · `GET /` · `GET /:id` · `PATCH /:id` · `DELETE /:id` · `PATCH /:id/assign` · `PATCH /:id/status` · `POST /:id/updates` · `GET /:id/updates` |
| **Service Requests** `/service-requests` | `POST /` · `GET /` · `GET /:id` · `PATCH /:id/assign` · `PATCH /:id/status` |
| **Payments** `/payments` | `POST /service-requests/:id/checkout` · `POST /complaints/:id/expedite` · `POST /confirm` · `POST /webhook` · `GET /` · `GET /:id` |
| **Reviews** `/reviews` | `POST /` · `GET /complaint/:id` (public) · `DELETE /:id` |
| **Notifications** `/notifications` | `GET /` · `PATCH /read-all` · `PATCH /:id/read` |
| **Dashboard** `/dashboard` | `GET /admin` · `GET /agent` · `GET /citizen` |
| **Meta** | `GET /` · `GET /health` · `GET /api-docs` · `GET /api-docs.json` |

## Response format

Every response uses a consistent envelope.

**Success**
```json
{ "success": true, "message": "Complaints fetched", "data": [], "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
```

**Error**
```json
{ "success": false, "message": "Validation failed", "errors": [ { "field": "email", "message": "A valid email is required" } ] }
```

`meta` is present only on paginated list endpoints; `errors` is an array (field-level for validation, otherwise empty).

## Payments (Stripe)

Two payment triggers, both using real Stripe Checkout Sessions (test mode):

1. **Service request** — `POST /api/payments/service-requests/:id/checkout` creates a session for the service fee and returns `checkoutUrl`. After paying, either the webhook or `POST /api/payments/confirm { sessionId }` marks the payment `COMPLETED` and moves the request to `PAID` — atomically.
2. **Complaint expedite** — `POST /api/payments/complaints/:id/expedite` charges the fixed `EXPEDITE_FEE`; on fulfilment the complaint becomes `isExpedited` with priority `URGENT`.

Fulfilment is **idempotent** and transactional, so confirm and webhook can both fire safely.

**Test card:** `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.

**Local webhook** (optional — the confirm endpoint already fulfils):
```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```
Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`. The webhook route uses a raw body parser for signature verification.

## Caching (Redis)

Cache-aside via ioredis for `GET /categories`, `GET /services`, and the admin dashboard (TTLs 3600/3600/60s), invalidated on relevant writes. If `REDIS_URL` is unset or unreachable, the cache helpers no-op and the API works normally.

## Deployment (Vercel)

The app exports a default handler and ships a [`vercel.json`](./vercel.json) that routes all traffic to the serverless function.

1. **Database** — create a Neon Postgres database; copy its `DATABASE_URL`.
2. **Apply schema** — from your machine (or CI), run against the production DB:
   ```bash
   npx prisma migrate deploy
   npm run prisma:seed        # optional: seed demo data
   ```
3. **Import the repo** into Vercel.
4. **Environment variables** — add `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `EXPEDITE_FEE`, `CLIENT_URL`, and optionally `REDIS_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` in the Vercel project settings.
5. **Deploy.** `postinstall` runs `prisma generate`; the schema's `binaryTargets` include the Lambda runtimes so the query engine ships in the bundle.
6. **Stripe webhook** — in the Stripe dashboard, add an endpoint at `https://<your-vercel-url>/api/payments/webhook` for the `checkout.session.completed` event and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## Demo credentials

Seeded by `npm run prisma:seed` (override the admin via `ADMIN_EMAIL` / `ADMIN_PASSWORD`):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@citycomplaint.com` | `Admin@1234` |
| Agent | `agent1@citycomplaint.com` | `Agent@1234` |
| Agent | `agent2@citycomplaint.com` | `Agent@1234` |
| Citizen | `citizen1@example.com` | `Citizen@1234` |
| Citizen | `citizen2@example.com` | `Citizen@1234` |
| Citizen | `citizen3@example.com` | `Citizen@1234` |

> These are **demo** credentials for evaluation. Never commit real secrets; set production values only as environment variables.
