import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate, requirePermissions } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { PERMISSIONS } from '../config/permissions';

export const analyticsRoutes = Router();

analyticsRoutes.use(authenticate, requirePermissions(PERMISSIONS.ANALYTICS_VIEW));

analyticsRoutes.get('/dashboard', asyncHandler(analyticsController.dashboard));
analyticsRoutes.get('/detailed', asyncHandler(analyticsController.detailed));
analyticsRoutes.get('/timeseries', asyncHandler(analyticsController.timeseries));
