import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { PERMISSIONS } from '../config/permissions';

export const reportRoutes = Router();

reportRoutes.use(authenticate, requirePermissions(PERMISSIONS.REPORT_EXPORT));
reportRoutes.get('/:type', asyncHandler(reportController.export));
