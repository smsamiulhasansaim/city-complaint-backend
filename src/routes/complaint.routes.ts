import { Router } from 'express';
import * as complaintController from '../controllers/complaint.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createComplaintSchema,
  listComplaintsSchema,
  complaintIdSchema,
  updateComplaintSchema,
} from '../validations/complaint.validation';

const router = Router();

// All complaint routes require authentication.
router.use(authenticate);

router.post(
  '/',
  authorize('CITIZEN'),
  validate(createComplaintSchema),
  complaintController.createComplaint
);
router.get('/', validate(listComplaintsSchema), complaintController.listComplaints);
router.get('/:id', validate(complaintIdSchema), complaintController.getComplaint);
router.patch(
  '/:id',
  authorize('CITIZEN'),
  validate(updateComplaintSchema),
  complaintController.updateComplaint
);
router.delete('/:id', validate(complaintIdSchema), complaintController.deleteComplaint);

export default router;
