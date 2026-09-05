import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { cacheDel, CacheKeys } from '../src/utils/cache';
import redis from '../src/config/redis';

/**
 * Idempotent seed. Users/categories/services are upserted on every run.
 * Sample content (complaints, service requests, payments, reviews,
 * notifications) is created only when no complaints exist yet, so re-running
 * the seed never duplicates rows.
 */

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@citycomplaint.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
const EXPEDITE_FEE = Number(process.env.EXPEDITE_FEE || 20);

const hash = (plain: string) => bcrypt.hash(plain, 10);

/**
 * Drop the cache-aside keys so the public /categories, /services and admin
 * dashboard reflect the freshly seeded rows immediately (no-op without Redis).
 */
async function clearReadCaches() {
  await cacheDel(CacheKeys.categories, CacheKeys.services, CacheKeys.adminDashboard);
}

async function upsertUser(opts: {
  name: string;
  email: string;
  password: string;
  role: 'CITIZEN' | 'AGENT' | 'ADMIN';
  ward?: string;
  phone?: string;
}) {
  const password = await hash(opts.password);
  return prisma.user.upsert({
    where: { email: opts.email },
    update: { name: opts.name, role: opts.role, ward: opts.ward, phone: opts.phone },
    create: {
      name: opts.name,
      email: opts.email,
      password,
      role: opts.role,
      ward: opts.ward,
      phone: opts.phone,
      authProvider: 'LOCAL',
      status: 'ACTIVE',
    },
  });
}

async function main() {
  // ---- Users -------------------------------------------------------------
  const admin = await upsertUser({
    name: 'City Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'ADMIN',
    phone: '+8801700000000',
  });

  const agent1 = await upsertUser({
    name: 'Agent Karim',
    email: 'agent1@citycomplaint.com',
    password: 'Agent@1234',
    role: 'AGENT',
    ward: 'Ward 5',
    phone: '+8801700000001',
  });
  const agent2 = await upsertUser({
    name: 'Agent Nadia',
    email: 'agent2@citycomplaint.com',
    password: 'Agent@1234',
    role: 'AGENT',
    ward: 'Ward 9',
    phone: '+8801700000002',
  });

  const citizen1 = await upsertUser({
    name: 'Rakib Hasan',
    email: 'citizen1@example.com',
    password: 'Citizen@1234',
    role: 'CITIZEN',
    ward: 'Ward 5',
    phone: '+8801800000001',
  });
  const citizen2 = await upsertUser({
    name: 'Sadia Islam',
    email: 'citizen2@example.com',
    password: 'Citizen@1234',
    role: 'CITIZEN',
    ward: 'Ward 9',
    phone: '+8801800000002',
  });
  const citizen3 = await upsertUser({
    name: 'Tanvir Ahmed',
    email: 'citizen3@example.com',
    password: 'Citizen@1234',
    role: 'CITIZEN',
    ward: 'Ward 12',
    phone: '+8801800000003',
  });

  // ---- Categories --------------------------------------------------------
  const categoryNames = [
    ['Road', 'Potholes, broken roads, damaged footpaths and signage'],
    ['Water', 'Water supply, leakage and drainage issues'],
    ['Electricity', 'Street lights and public electrical faults'],
    ['Waste', 'Garbage collection and illegal dumping'],
    ['Sanitation', 'Public toilets, sewage and cleanliness'],
    ['Public Safety', 'Unsafe structures, hazards and public safety'],
  ] as const;

  const categories: Record<string, { id: string }> = {};
  for (const [name, description] of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
    categories[name] = cat;
  }

  // ---- Services (paid) ---------------------------------------------------
  const serviceDefs = [
    ['Trade License', 'Apply for or renew a municipal trade license', 50],
    ['Building Permit', 'Approval for new construction or renovation', 150],
    ['Waste Bin Purchase', 'Purchase a municipal household waste bin', 25],
    ['Tree-Cutting Permit', 'Permit to cut or trim a tree on your property', 40],
  ] as const;

  const services: Record<string, { id: string; fee: Prisma.Decimal }> = {};
  for (const [name, description, fee] of serviceDefs) {
    const svc = await prisma.service.upsert({
      where: { name },
      update: { description, fee },
      create: { name, description, fee },
    });
    services[name] = svc;
  }

  // ---- Sample content (only when the DB has no complaints yet) -----------
  const existingComplaints = await prisma.complaint.count();
  if (existingComplaints > 0) {
    // eslint-disable-next-line no-console
    console.log('↩︎  Sample content already present — skipping content seed.');
    await clearReadCaches();
    return;
  }

  // c1 — PENDING, unassigned
  await prisma.complaint.create({
    data: {
      title: 'Large pothole on Main Road',
      description: 'A deep pothole near the market is damaging vehicles.',
      ward: 'Ward 5',
      address: 'Main Road, near central market',
      priority: 'MEDIUM',
      status: 'PENDING',
      citizenId: citizen1.id,
      categoryId: categories['Road'].id,
    },
  });

  // c2 — ASSIGNED to agent1
  await prisma.complaint.create({
    data: {
      title: 'Water leakage flooding the street',
      description: 'A burst pipe has been flooding the lane for two days.',
      ward: 'Ward 5',
      priority: 'HIGH',
      status: 'ASSIGNED',
      citizenId: citizen1.id,
      assignedAgentId: agent1.id,
      categoryId: categories['Water'].id,
      updates: {
        create: [
          {
            fromStatus: 'PENDING',
            toStatus: 'ASSIGNED',
            note: 'Assigned to Agent Karim.',
            authorId: admin.id,
          },
        ],
      },
    },
  });

  // c3 — IN_PROGRESS
  await prisma.complaint.create({
    data: {
      title: 'Street light not working',
      description: 'The street light at the corner has been off for a week.',
      ward: 'Ward 9',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      citizenId: citizen2.id,
      assignedAgentId: agent1.id,
      categoryId: categories['Electricity'].id,
      updates: {
        create: [
          { fromStatus: 'PENDING', toStatus: 'ASSIGNED', note: 'Assigned.', authorId: admin.id },
          {
            fromStatus: 'ASSIGNED',
            toStatus: 'IN_PROGRESS',
            note: 'Technician dispatched.',
            authorId: agent1.id,
          },
        ],
      },
    },
  });

  // c4 — RESOLVED, with a review
  const resolved = await prisma.complaint.create({
    data: {
      title: 'Overflowing garbage bin',
      description: 'The community bin has not been emptied in days.',
      ward: 'Ward 9',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      resolvedAt: new Date(),
      citizenId: citizen2.id,
      assignedAgentId: agent2.id,
      categoryId: categories['Waste'].id,
      updates: {
        create: [
          { fromStatus: 'PENDING', toStatus: 'ASSIGNED', note: 'Assigned.', authorId: admin.id },
          {
            fromStatus: 'ASSIGNED',
            toStatus: 'IN_PROGRESS',
            note: 'Crew scheduled.',
            authorId: agent2.id,
          },
          {
            fromStatus: 'IN_PROGRESS',
            toStatus: 'RESOLVED',
            note: 'Bin emptied and area cleaned.',
            authorId: agent2.id,
          },
        ],
      },
      review: {
        create: {
          rating: 5,
          comment: 'Fast and professional response. Thank you!',
          citizenId: citizen2.id,
        },
      },
    },
  });

  // c5 — REJECTED
  await prisma.complaint.create({
    data: {
      title: 'Neighbour parking complaint',
      description: 'Request to remove a neighbour’s car.',
      ward: 'Ward 12',
      priority: 'LOW',
      status: 'REJECTED',
      citizenId: citizen3.id,
      assignedAgentId: agent2.id,
      categoryId: categories['Public Safety'].id,
      updates: {
        create: [
          {
            fromStatus: 'PENDING',
            toStatus: 'REJECTED',
            note: 'Private dispute — outside municipal scope.',
            authorId: agent2.id,
          },
        ],
      },
    },
  });

  // c6 — expedited (paid) complaint
  const expedited = await prisma.complaint.create({
    data: {
      title: 'Blocked sewage line — health hazard',
      description: 'Raw sewage overflowing near a school; urgent attention needed.',
      ward: 'Ward 12',
      priority: 'URGENT',
      status: 'ASSIGNED',
      isExpedited: true,
      citizenId: citizen3.id,
      assignedAgentId: agent1.id,
      categoryId: categories['Sanitation'].id,
      updates: {
        create: [
          {
            fromStatus: 'PENDING',
            toStatus: 'ASSIGNED',
            note: 'Expedited by citizen — prioritised.',
            authorId: admin.id,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      transactionId: 'seed_sess_expedite_c6',
      amount: EXPEDITE_FEE,
      purpose: 'COMPLAINT_EXPEDITE',
      status: 'COMPLETED',
      paidAt: new Date(),
      payerId: citizen3.id,
      complaintId: expedited.id,
    },
  });

  // ---- Service requests --------------------------------------------------
  // sr1 — awaiting payment
  await prisma.serviceRequest.create({
    data: {
      serviceId: services['Trade License'].id,
      citizenId: citizen1.id,
      details: 'New grocery shop trade license application.',
      status: 'PENDING_PAYMENT',
    },
  });

  // sr2 — PAID
  const sr2 = await prisma.serviceRequest.create({
    data: {
      serviceId: services['Waste Bin Purchase'].id,
      citizenId: citizen2.id,
      details: 'One 120L household bin.',
      status: 'PAID',
    },
  });
  await prisma.payment.create({
    data: {
      transactionId: 'seed_sess_sr2',
      amount: services['Waste Bin Purchase'].fee,
      purpose: 'SERVICE_REQUEST',
      status: 'COMPLETED',
      paidAt: new Date(),
      payerId: citizen2.id,
      serviceRequestId: sr2.id,
    },
  });

  // sr3 — COMPLETED, assigned
  const sr3 = await prisma.serviceRequest.create({
    data: {
      serviceId: services['Building Permit'].id,
      citizenId: citizen3.id,
      assignedAgentId: agent2.id,
      details: 'Two-storey residential extension.',
      status: 'COMPLETED',
    },
  });
  await prisma.payment.create({
    data: {
      transactionId: 'seed_sess_sr3',
      amount: services['Building Permit'].fee,
      purpose: 'SERVICE_REQUEST',
      status: 'COMPLETED',
      paidAt: new Date(),
      payerId: citizen3.id,
      serviceRequestId: sr3.id,
    },
  });

  // ---- Notifications -----------------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        userId: citizen2.id,
        type: 'COMPLAINT',
        message: 'Your complaint “Overflowing garbage bin” was resolved.',
        isRead: false,
      },
      {
        userId: agent1.id,
        type: 'COMPLAINT',
        message: 'A new complaint was assigned to you.',
        isRead: false,
      },
      {
        userId: citizen3.id,
        type: 'PAYMENT',
        message: 'Your expedite payment was received.',
        isRead: true,
      },
    ],
  });

  await clearReadCaches();

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete.');
}

// Close the optional Redis connection so the process can exit (it stays open
// with a retry strategy otherwise, hanging the seed on CI / Vercel builds).
async function shutdown() {
  await prisma.$disconnect();
  if (redis) {
    try {
      await redis.quit();
    } catch {
      /* best-effort */
    }
  }
}

main()
  .then(shutdown)
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await shutdown();
    process.exit(1);
  });
