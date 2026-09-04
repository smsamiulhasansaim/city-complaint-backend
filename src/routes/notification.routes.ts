import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  listNotificationsSchema,
  notificationIdSchema,
} from '../validations/notification.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(listNotificationsSchema), notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate(notificationIdSchema), notificationController.markRead);

export default router;
