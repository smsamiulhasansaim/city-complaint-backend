import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  listUsersSchema,
  userIdSchema,
  createAgentSchema,
  updateRoleSchema,
  updateStatusSchema,
} from '../validations/user.validation';

const router = Router();

// Every user-management route is admin-only.
router.use(authenticate, authorize('ADMIN'));

router.get('/', validate(listUsersSchema), userController.listUsers);
router.post('/agents', validate(createAgentSchema), userController.createAgent);
router.get('/:id', validate(userIdSchema), userController.getUser);
router.patch('/:id/role', validate(updateRoleSchema), userController.updateRole);
router.patch('/:id/status', validate(updateStatusSchema), userController.updateStatus);
router.delete('/:id', validate(userIdSchema), userController.deleteUser);

export default router;
