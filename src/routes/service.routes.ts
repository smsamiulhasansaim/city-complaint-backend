import { Router } from 'express';
import * as serviceController from '../controllers/service.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  serviceIdSchema,
  createServiceSchema,
  updateServiceSchema,
} from '../validations/service.validation';

const router = Router();

// Public reads.
router.get('/', serviceController.listServices);
router.get('/:id', validate(serviceIdSchema), serviceController.getService);

// Admin-only writes.
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createServiceSchema),
  serviceController.createService
);
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateServiceSchema),
  serviceController.updateService
);
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(serviceIdSchema),
  serviceController.deleteService
);

export default router;
