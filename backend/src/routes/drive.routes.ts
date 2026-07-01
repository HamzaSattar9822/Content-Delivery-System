import { Router } from 'express';
import { driveController } from '../controllers/drive.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { PERMISSIONS } from '../config/permissions';

export const driveRoutes = Router();

driveRoutes.use(authenticate, requirePermissions(PERMISSIONS.DRIVE_BROWSE));

driveRoutes.get('/status', asyncHandler(driveController.status));
driveRoutes.get('/files', asyncHandler(driveController.browse));
driveRoutes.get('/files/:fileId', asyncHandler(driveController.getFile));
