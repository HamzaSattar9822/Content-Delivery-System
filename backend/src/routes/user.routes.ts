import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, requirePermissions, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validate';
import { PERMISSIONS, ROLES } from '../config/permissions';
import { createUserSchema, idParam, setUserPasswordSchema, updateUserSchema } from '../validation/schemas';

export const userRoutes = Router();

userRoutes.use(authenticate);

userRoutes.get('/roles', requirePermissions(PERMISSIONS.USER_VIEW), asyncHandler(userController.roles));
userRoutes.get('/', requirePermissions(PERMISSIONS.USER_VIEW), asyncHandler(userController.list));
userRoutes.get('/:id', requirePermissions(PERMISSIONS.USER_VIEW), validate(idParam, 'params'), asyncHandler(userController.get));
userRoutes.post('/', requirePermissions(PERMISSIONS.USER_MANAGE), validate(createUserSchema), asyncHandler(userController.create));
userRoutes.patch(
  '/:id',
  requirePermissions(PERMISSIONS.USER_MANAGE),
  validate(idParam, 'params'),
  validate(updateUserSchema),
  asyncHandler(userController.update),
);
userRoutes.post(
  '/:id/password',
  requireRole(ROLES.SUPER_ADMIN),
  validate(idParam, 'params'),
  validate(setUserPasswordSchema),
  asyncHandler(userController.setPassword),
);
userRoutes.delete('/:id', requirePermissions(PERMISSIONS.USER_MANAGE), validate(idParam, 'params'), asyncHandler(userController.remove));
