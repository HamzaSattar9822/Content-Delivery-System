import { Router } from 'express';
import { settingController } from '../controllers/setting.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import { updateSettingSchema } from '../validation/schemas';

export const settingRoutes = Router();

settingRoutes.use(authenticate);

settingRoutes.get('/', requirePermissions(PERMISSIONS.SETTINGS_VIEW), asyncHandler(settingController.list));
settingRoutes.get('/:key', requirePermissions(PERMISSIONS.SETTINGS_VIEW), asyncHandler(settingController.get));
settingRoutes.put(
  '/:key',
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateSettingSchema),
  asyncHandler(settingController.update),
);
