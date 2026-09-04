import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  googleSchema,
  updateMeSchema,
  changePasswordSchema,
} from '../validations/auth.validation';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/google', validate(googleSchema), authController.googleLogin);

router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, validate(updateMeSchema), authController.updateMe);
router.patch(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;
