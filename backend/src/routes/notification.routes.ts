import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import { createNotificationRuleSchema, idParam, updateNotificationRuleSchema } from '../validation/schemas';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/', requirePermissions(PERMISSIONS.NOTIFICATION_VIEW), asyncHandler(notificationController.listNotifications));
notificationRoutes.get('/rules', requirePermissions(PERMISSIONS.NOTIFICATION_VIEW), asyncHandler(notificationController.listRules));
notificationRoutes.post(
  '/rules',
  requirePermissions(PERMISSIONS.NOTIFICATION_MANAGE),
  validate(createNotificationRuleSchema),
  asyncHandler(notificationController.createRule),
);
notificationRoutes.patch(
  '/rules/:id',
  requirePermissions(PERMISSIONS.NOTIFICATION_MANAGE),
  validate(idParam, 'params'),
  validate(updateNotificationRuleSchema),
  asyncHandler(notificationController.updateRule),
);
notificationRoutes.delete(
  '/rules/:id',
  requirePermissions(PERMISSIONS.NOTIFICATION_MANAGE),
  validate(idParam, 'params'),
  asyncHandler(notificationController.deleteRule),
);
