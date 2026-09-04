import { Router } from 'express';
import * as complaintController from '../controllers/complaint.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createComplaintSchema,
  listComplaintsSchema,
  complaintIdSchema,
  updateComplaintSchema,
  assignComplaintSchema,
  complaintStatusSchema,
  addComplaintUpdateSchema,
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

// Workflow: assignment (admin) and status transitions (assigned agent or admin).
router.patch(
  '/:id/assign',
  authorize('ADMIN'),
  validate(assignComplaintSchema),
  complaintController.assignComplaint
);
router.patch(
  '/:id/status',
  authorize('AGENT', 'ADMIN'),
  validate(complaintStatusSchema),
  complaintController.changeStatus
);

// Timeline / conversation.
router.post(
  '/:id/updates',
  validate(addComplaintUpdateSchema),
  complaintController.addUpdate
);
router.get('/:id/updates', validate(complaintIdSchema), complaintController.listUpdates);

export default router;
