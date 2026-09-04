import { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Hand-authored OpenAPI 3 definition. We run it through swagger-jsdoc (with no
 * file globs) so the object is normalized/validated, then serve it via
 * swagger-ui-express at /api-docs and as raw JSON at /api-docs.json.
 */

const bearerAuth = [{ bearerAuth: [] }];

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
];

// Shorthand response builders keyed to the mandatory envelope.
const ok = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
  },
});
const errRef = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
  },
});

const common = {
  400: errRef('Bad request'),
  401: errRef('Unauthorized — missing or invalid token'),
  403: errRef('Forbidden — insufficient role/permission'),
  404: errRef('Resource not found'),
  409: errRef('Conflict'),
  422: errRef('Validation failed'),
};

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'City Complaint & Service Platform API',
    version: '1.0.0',
    description:
      'RESTful API where citizens file civic complaints and request paid municipal services, ' +
      'agents resolve assigned work, and admins oversee the platform. JWT auth with ' +
      'email/password and Google (GCP) social login, strict 3-role RBAC (CITIZEN, AGENT, ADMIN), ' +
      'Stripe payments, and Redis caching.\n\n' +
      'All responses follow `{ success, message, data }` on success and ' +
      '`{ success, message, errors }` on failure.',
  },
  servers: [{ url: '/', description: 'Current host' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, Google login & profile' },
    { name: 'Users', description: 'Admin user management' },
    { name: 'Categories', description: 'Complaint categories (public reads, admin writes)' },
    { name: 'Services', description: 'Paid municipal service catalog' },
    { name: 'Complaints', description: 'Civic complaint lifecycle' },
    { name: 'Service Requests', description: 'Paid service requests' },
    { name: 'Payments', description: 'Stripe checkout, confirmation & history' },
    { name: 'Reviews', description: 'Citizen feedback on resolved complaints' },
    { name: 'Notifications', description: 'Per-user notification feed' },
    { name: 'Dashboard', description: 'Role-scoped statistics' },
    { name: 'Meta', description: 'Health & info' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the JWT returned by /api/auth/login or /api/auth/google.',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: { type: 'object', nullable: true },
          meta: {
            type: 'object',
            nullable: true,
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 10 },
              total: { type: 'integer', example: 42 },
              totalPages: { type: 'integer', example: 5 },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'A valid email is required' },
              },
            },
          },
        },
      },
    },
  },
  security: bearerAuth,
  paths: {
    '/health': {
      get: {
        tags: ['Meta'],
        summary: 'Liveness probe',
        security: [],
        responses: { 200: ok('Service healthy') },
      },
    },

    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new citizen',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Rakib Hasan' },
                  email: { type: 'string', example: 'citizen@example.com' },
                  password: { type: 'string', example: 'Citizen@1234' },
                  phone: { type: 'string', example: '+8801700000000' },
                  address: { type: 'string' },
                  ward: { type: 'string', example: 'Ward 12' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Registered — returns user & JWT'), 409: common[409], 422: common[422] },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Email/password login',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@citycomplaint.com' },
                  password: { type: 'string', example: 'Admin@1234' },
                },
              },
            },
          },
        },
        responses: { 200: ok('Logged in — returns user & JWT'), 401: common[401], 422: common[422] },
      },
    },
    '/api/auth/google': {
      post: {
        tags: ['Auth'],
        summary: 'Google (GCP) social login',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idToken'],
                properties: { idToken: { type: 'string', description: 'Google ID token' } },
              },
            },
          },
        },
        responses: { 200: ok('Logged in — returns user & JWT'), 401: common[401] },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: bearerAuth,
        responses: { 200: ok('Current user'), 401: common[401] },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update own profile',
        security: bearerAuth,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  address: { type: 'string' },
                  ward: { type: 'string' },
                  avatar: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: { 200: ok('Profile updated'), 401: common[401], 422: common[422] },
      },
    },
    '/api/auth/me/password': {
      patch: {
        tags: ['Auth'],
        summary: 'Change own password',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: ok('Password changed'), 401: common[401], 422: common[422] },
      },
    },

    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (admin)',
        security: bearerAuth,
        parameters: [
          ...paginationParams,
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['CITIZEN', 'AGENT', 'ADMIN'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'BANNED'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: ok('Users'), 401: common[401], 403: common[403] },
      },
    },
    '/api/users/agents': {
      post: {
        tags: ['Users'],
        summary: 'Create an agent account (admin)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  phone: { type: 'string' },
                  ward: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Agent created'), 403: common[403], 409: common[409] },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get a user (admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('User'), 403: common[403], 404: common[404] },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete a user with no activity (admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Deleted'), 403: common[403], 404: common[404], 409: common[409] },
      },
    },
    '/api/users/{id}/role': {
      patch: {
        tags: ['Users'],
        summary: 'Change a user role (admin)',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: { role: { type: 'string', enum: ['CITIZEN', 'AGENT', 'ADMIN'] } },
              },
            },
          },
        },
        responses: { 200: ok('Role updated'), 403: common[403], 404: common[404] },
      },
    },
    '/api/users/{id}/status': {
      patch: {
        tags: ['Users'],
        summary: 'Ban/unban a user (admin)',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string', enum: ['ACTIVE', 'BANNED'] } },
              },
            },
          },
        },
        responses: { 200: ok('Status updated'), 403: common[403], 404: common[404] },
      },
    },

    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List active categories (public, cached)',
        security: [],
        responses: { 200: ok('Categories') },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create a category (admin)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Road' },
                  description: { type: 'string' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Created'), 403: common[403], 409: common[409] },
      },
    },
    '/api/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get a category',
        security: [],
        parameters: [idParam],
        responses: { 200: ok('Category'), 404: common[404] },
      },
      patch: {
        tags: ['Categories'],
        summary: 'Update a category (admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Updated'), 403: common[403], 404: common[404] },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete/disable a category (admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Deleted or soft-disabled'), 403: common[403], 404: common[404] },
      },
    },

    '/api/services': {
      get: {
        tags: ['Services'],
        summary: 'List active services (public, cached)',
        security: [],
        responses: { 200: ok('Services') },
      },
      post: {
        tags: ['Services'],
        summary: 'Create a service (admin)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'description', 'fee'],
                properties: {
                  name: { type: 'string', example: 'Trade License' },
                  description: { type: 'string' },
                  fee: { type: 'number', example: 50 },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Created'), 403: common[403], 409: common[409] },
      },
    },
    '/api/services/{id}': {
      get: {
        tags: ['Services'],
        summary: 'Get a service',
        security: [],
        parameters: [idParam],
        responses: { 200: ok('Service'), 404: common[404] },
      },
      patch: {
        tags: ['Services'],
        summary: 'Update a service (admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Updated'), 403: common[403], 404: common[404] },
      },
      delete: {
        tags: ['Services'],
        summary: 'Delete/disable a service (admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Deleted or soft-disabled'), 403: common[403], 404: common[404] },
      },
    },

    '/api/complaints': {
      post: {
        tags: ['Complaints'],
        summary: 'File a complaint (citizen)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'categoryId'],
                properties: {
                  title: { type: 'string', example: 'Broken street light on Main Rd' },
                  description: { type: 'string' },
                  categoryId: { type: 'string', format: 'uuid' },
                  ward: { type: 'string' },
                  address: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  images: { type: 'array', items: { type: 'string', format: 'uri' } },
                  priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                },
              },
            },
          },
        },
        responses: { 201: ok('Complaint filed'), 401: common[401], 403: common[403], 422: common[422] },
      },
      get: {
        tags: ['Complaints'],
        summary: 'List complaints (role-scoped)',
        security: bearerAuth,
        parameters: [
          ...paginationParams,
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'ward', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'oldest'] } },
        ],
        responses: { 200: ok('Complaints'), 401: common[401] },
      },
    },
    '/api/complaints/{id}': {
      get: {
        tags: ['Complaints'],
        summary: 'Get a complaint',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Complaint'), 403: common[403], 404: common[404] },
      },
      patch: {
        tags: ['Complaints'],
        summary: 'Edit own pending complaint (citizen)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Updated'), 403: common[403], 404: common[404] },
      },
      delete: {
        tags: ['Complaints'],
        summary: 'Delete a complaint (owner if pending, or admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Deleted'), 403: common[403], 404: common[404] },
      },
    },
    '/api/complaints/{id}/assign': {
      patch: {
        tags: ['Complaints'],
        summary: 'Assign a complaint to an agent (admin)',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['agentId'],
                properties: { agentId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: { 200: ok('Assigned'), 403: common[403], 404: common[404] },
      },
    },
    '/api/complaints/{id}/status': {
      patch: {
        tags: ['Complaints'],
        summary: 'Change complaint status (assigned agent or admin)',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'],
                  },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: ok('Status updated'), 400: common[400], 403: common[403] },
      },
    },
    '/api/complaints/{id}/updates': {
      get: {
        tags: ['Complaints'],
        summary: 'Complaint timeline',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Timeline'), 403: common[403], 404: common[404] },
      },
      post: {
        tags: ['Complaints'],
        summary: 'Add a note to the timeline',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['note'],
                properties: { note: { type: 'string' } },
              },
            },
          },
        },
        responses: { 201: ok('Note added'), 403: common[403], 404: common[404] },
      },
    },

    '/api/service-requests': {
      post: {
        tags: ['Service Requests'],
        summary: 'Create a service request (citizen)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['serviceId'],
                properties: {
                  serviceId: { type: 'string', format: 'uuid' },
                  details: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Created — awaiting payment'), 403: common[403], 422: common[422] },
      },
      get: {
        tags: ['Service Requests'],
        summary: 'List service requests (role-scoped)',
        security: bearerAuth,
        parameters: [
          ...paginationParams,
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'serviceId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: ok('Service requests'), 401: common[401] },
      },
    },
    '/api/service-requests/{id}': {
      get: {
        tags: ['Service Requests'],
        summary: 'Get a service request',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Service request'), 403: common[403], 404: common[404] },
      },
    },
    '/api/service-requests/{id}/assign': {
      patch: {
        tags: ['Service Requests'],
        summary: 'Assign to an agent (admin)',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['agentId'],
                properties: { agentId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: { 200: ok('Assigned'), 400: common[400], 403: common[403] },
      },
    },
    '/api/service-requests/{id}/status': {
      patch: {
        tags: ['Service Requests'],
        summary: 'Change status (assigned agent or admin)',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['PENDING_PAYMENT', 'PAID', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'],
                  },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: ok('Status updated'), 400: common[400], 403: common[403] },
      },
    },

    '/api/payments/service-requests/{id}/checkout': {
      post: {
        tags: ['Payments'],
        summary: 'Create Stripe checkout for a service request (citizen)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 201: ok('Checkout session — returns checkoutUrl'), 403: common[403], 404: common[404] },
      },
    },
    '/api/payments/complaints/{id}/expedite': {
      post: {
        tags: ['Payments'],
        summary: 'Create Stripe checkout to expedite a complaint (citizen)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 201: ok('Checkout session — returns checkoutUrl'), 400: common[400], 403: common[403] },
      },
    },
    '/api/payments/confirm': {
      post: {
        tags: ['Payments'],
        summary: 'Confirm a Stripe session & fulfil the payment',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId'],
                properties: { sessionId: { type: 'string', example: 'cs_test_...' } },
              },
            },
          },
        },
        responses: { 200: ok('Payment confirmed'), 400: common[400], 404: common[404] },
      },
    },
    '/api/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Stripe webhook (raw body, signature-verified)',
        security: [],
        responses: { 200: { description: 'Event acknowledged' }, 400: errRef('Invalid signature') },
      },
    },
    '/api/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List payments (own for citizen, all for admin)',
        security: bearerAuth,
        parameters: [
          ...paginationParams,
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'purpose', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: ok('Payments'), 401: common[401] },
      },
    },
    '/api/payments/{id}': {
      get: {
        tags: ['Payments'],
        summary: 'Get a payment',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Payment'), 403: common[403], 404: common[404] },
      },
    },

    '/api/reviews': {
      post: {
        tags: ['Reviews'],
        summary: 'Review a resolved/closed complaint (citizen)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['complaintId', 'rating', 'comment'],
                properties: {
                  complaintId: { type: 'string', format: 'uuid' },
                  rating: { type: 'integer', minimum: 1, maximum: 5 },
                  comment: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Review submitted'), 400: common[400], 403: common[403], 409: common[409] },
      },
    },
    '/api/reviews/complaint/{id}': {
      get: {
        tags: ['Reviews'],
        summary: 'Get the review for a complaint (public)',
        security: [],
        parameters: [idParam],
        responses: { 200: ok('Review or null'), 404: common[404] },
      },
    },
    '/api/reviews/{id}': {
      delete: {
        tags: ['Reviews'],
        summary: 'Delete a review (owner or admin)',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Deleted'), 403: common[403], 404: common[404] },
      },
    },

    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List own notifications',
        security: bearerAuth,
        parameters: [
          ...paginationParams,
          { name: 'isRead', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: { 200: ok('Notifications + unreadCount'), 401: common[401] },
      },
    },
    '/api/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark all as read',
        security: bearerAuth,
        responses: { 200: ok('All marked read'), 401: common[401] },
      },
    },
    '/api/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark one as read',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 200: ok('Marked read'), 404: common[404] },
      },
    },

    '/api/dashboard/admin': {
      get: {
        tags: ['Dashboard'],
        summary: 'Admin platform stats (cached)',
        security: bearerAuth,
        responses: { 200: ok('Admin dashboard'), 403: common[403] },
      },
    },
    '/api/dashboard/agent': {
      get: {
        tags: ['Dashboard'],
        summary: 'Agent workload stats',
        security: bearerAuth,
        responses: { 200: ok('Agent dashboard'), 403: common[403] },
      },
    },
    '/api/dashboard/citizen': {
      get: {
        tags: ['Dashboard'],
        summary: 'Citizen activity stats',
        security: bearerAuth,
        responses: { 200: ok('Citizen dashboard'), 403: common[403] },
      },
    },
  },
};

const swaggerSpec = swaggerJsdoc({ definition, apis: [] });

export const setupSwagger = (app: Application): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'City Complaint API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );

  // Raw spec for Postman import / tooling.
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export default swaggerSpec;
