import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/admin', authorize('ADMIN'), dashboardController.adminDashboard);
router.get('/agent', authorize('AGENT'), dashboardController.agentDashboard);
router.get('/citizen', authorize('CITIZEN'), dashboardController.citizenDashboard);

export default router;
