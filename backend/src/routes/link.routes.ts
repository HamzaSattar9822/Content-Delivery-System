import { Router } from 'express';
import { linkController } from '../controllers/link.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import {
  createLinkSchema,
  extendExpirationSchema,
  idParam,
  increaseViewLimitSchema,
  updateLinkSchema,
} from '../validation/schemas';

export const linkRoutes = Router();

linkRoutes.use(authenticate);

linkRoutes.get('/', requirePermissions(PERMISSIONS.LINK_VIEW), asyncHandler(linkController.list));
linkRoutes.get('/:id', requirePermissions(PERMISSIONS.LINK_VIEW), validate(idParam, 'params'), asyncHandler(linkController.get));

linkRoutes.post(
  '/',
  requirePermissions(PERMISSIONS.LINK_MANAGE),
  validate(createLinkSchema),
  asyncHandler(linkController.create),
);
linkRoutes.patch(
  '/:id',
  requirePermissions(PERMISSIONS.LINK_MANAGE),
  validate(idParam, 'params'),
  validate(updateLinkSchema),
  asyncHandler(linkController.update),
);
linkRoutes.post('/:id/disable', requirePermissions(PERMISSIONS.LINK_MANAGE), validate(idParam, 'params'), asyncHandler(linkController.disable));
linkRoutes.post('/:id/enable', requirePermissions(PERMISSIONS.LINK_MANAGE), validate(idParam, 'params'), asyncHandler(linkController.enable));
linkRoutes.post('/:id/revoke', requirePermissions(PERMISSIONS.LINK_MANAGE), validate(idParam, 'params'), asyncHandler(linkController.revoke));
linkRoutes.post(
  '/:id/extend',
  requirePermissions(PERMISSIONS.LINK_MANAGE),
  validate(idParam, 'params'),
  validate(extendExpirationSchema),
  asyncHandler(linkController.extend),
);
linkRoutes.post(
  '/:id/increase-views',
  requirePermissions(PERMISSIONS.LINK_MANAGE),
  validate(idParam, 'params'),
  validate(increaseViewLimitSchema),
  asyncHandler(linkController.increaseViews),
);
linkRoutes.delete('/:id', requirePermissions(PERMISSIONS.LINK_MANAGE), validate(idParam, 'params'), asyncHandler(linkController.remove));
