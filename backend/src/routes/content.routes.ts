import { Router } from 'express';
import { contentController } from '../controllers/content.controller';
import { categoryController, tagController } from '../controllers/taxonomy.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import {
  createCategorySchema,
  createContentSchema,
  idParam,
  updateContentSchema,
} from '../validation/schemas';

export const contentRoutes = Router();

contentRoutes.use(authenticate);

// Categories
contentRoutes.get('/categories', requirePermissions(PERMISSIONS.CONTENT_VIEW), asyncHandler(categoryController.list));
contentRoutes.post(
  '/categories',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(createCategorySchema),
  asyncHandler(categoryController.create),
);
contentRoutes.patch(
  '/categories/:id',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(idParam, 'params'),
  asyncHandler(categoryController.update),
);
contentRoutes.delete(
  '/categories/:id',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(idParam, 'params'),
  asyncHandler(categoryController.remove),
);

// Tags
contentRoutes.get('/tags', requirePermissions(PERMISSIONS.CONTENT_VIEW), asyncHandler(tagController.list));

// Content
contentRoutes.get('/', requirePermissions(PERMISSIONS.CONTENT_VIEW), asyncHandler(contentController.list));
contentRoutes.get('/:id', requirePermissions(PERMISSIONS.CONTENT_VIEW), validate(idParam, 'params'), asyncHandler(contentController.get));
contentRoutes.post(
  '/',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(createContentSchema),
  asyncHandler(contentController.create),
);
contentRoutes.patch(
  '/:id',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(idParam, 'params'),
  validate(updateContentSchema),
  asyncHandler(contentController.update),
);
contentRoutes.post(
  '/:id/archive',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(idParam, 'params'),
  asyncHandler(contentController.archive),
);
contentRoutes.post(
  '/:id/restore',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(idParam, 'params'),
  asyncHandler(contentController.restore),
);
contentRoutes.delete(
  '/:id',
  requirePermissions(PERMISSIONS.CONTENT_MANAGE),
  validate(idParam, 'params'),
  asyncHandler(contentController.remove),
);
