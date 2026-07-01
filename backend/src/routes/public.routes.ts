import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { publicController } from '../controllers/public.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validate';
import { accessRequestSchema, heartbeatSchema } from '../validation/schemas';

export const publicRoutes = Router();

// Rate-limit the public surface to slow brute-force/token-guessing.
const accessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

publicRoutes.use(accessLimiter);

publicRoutes.get('/links/:token', asyncHandler(publicController.resolve));
publicRoutes.post('/links/:token/access', validate(accessRequestSchema), asyncHandler(publicController.access));
publicRoutes.post('/links/:token/heartbeat', validate(heartbeatSchema), asyncHandler(publicController.heartbeat));
publicRoutes.post('/links/:token/end', asyncHandler(publicController.end));
publicRoutes.get('/stream', asyncHandler(publicController.stream));
