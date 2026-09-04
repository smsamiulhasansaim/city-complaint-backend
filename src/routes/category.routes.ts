import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from '../validations/category.validation';

const router = Router();

// Public reads.
router.get('/', categoryController.listCategories);
router.get('/:id', validate(categoryIdSchema), categoryController.getCategory);

// Admin-only writes.
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createCategorySchema),
  categoryController.createCategory
);
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateCategorySchema),
  categoryController.updateCategory
);
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(categoryIdSchema),
  categoryController.deleteCategory
);

export default router;
