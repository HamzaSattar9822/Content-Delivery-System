import { Router } from 'express';
import { meRoutes } from './me.routes';
import { contentRoutes } from './content.routes';
import { driveRoutes } from './drive.routes';
import { linkRoutes } from './link.routes';
import { userRoutes } from './user.routes';
import { analyticsRoutes } from './analytics.routes';
import { notificationRoutes } from './notification.routes';
import { auditRoutes } from './audit.routes';
import { settingRoutes } from './setting.routes';
import { reportRoutes } from './report.routes';
import { publicRoutes } from './public.routes';

export const apiRouter = Router();

apiRouter.use('/me', meRoutes);
apiRouter.use('/content', contentRoutes);
apiRouter.use('/drive', driveRoutes);
apiRouter.use('/links', linkRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/settings', settingRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/public', publicRoutes);
