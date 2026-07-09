import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { PERMISSIONS } from '../config/permissions';

export const auditRoutes = Router();

auditRoutes.use(authenticate, requirePermissions(PERMISSIONS.AUDIT_VIEW));
auditRoutes.get('/', asyncHandler(auditController.list));
