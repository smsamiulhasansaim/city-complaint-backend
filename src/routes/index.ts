import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import serviceRoutes from './service.routes';
import complaintRoutes from './complaint.routes';
import serviceRequestRoutes from './serviceRequest.routes';
import paymentRoutes from './payment.routes';
import reviewRoutes from './review.routes';
import notificationRoutes from './notification.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/services', serviceRoutes);
router.use('/complaints', complaintRoutes);
router.use('/service-requests', serviceRequestRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
