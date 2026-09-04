import { Router } from 'express';
import * as srController from '../controllers/serviceRequest.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createServiceRequestSchema,
  listServiceRequestsSchema,
  serviceRequestIdSchema,
  assignServiceRequestSchema,
  serviceRequestStatusSchema,
} from '../validations/serviceRequest.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('CITIZEN'),
  validate(createServiceRequestSchema),
  srController.createServiceRequest
);
router.get(
  '/',
  validate(listServiceRequestsSchema),
  srController.listServiceRequests
);
router.get('/:id', validate(serviceRequestIdSchema), srController.getServiceRequest);
router.patch(
  '/:id/assign',
  authorize('ADMIN'),
  validate(assignServiceRequestSchema),
  srController.assignServiceRequest
);
router.patch(
  '/:id/status',
  authorize('AGENT', 'ADMIN'),
  validate(serviceRequestStatusSchema),
  srController.changeStatus
);

export default router;
