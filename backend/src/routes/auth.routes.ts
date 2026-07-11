import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validate';
import { devLoginSchema, loginSchema, signupSchema } from '../validation/schemas';

export const authRoutes = Router();

authRoutes.get('/config', authController.config);
authRoutes.get('/google', authController.googleStart);
authRoutes.get('/google/callback', asyncHandler(authController.googleCallback));
authRoutes.post('/signup', validate(signupSchema), asyncHandler(authController.signup));
authRoutes.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRoutes.post('/dev-login', validate(devLoginSchema), asyncHandler(authController.devLogin));
authRoutes.post('/refresh', asyncHandler(authController.refresh));
authRoutes.post('/logout', asyncHandler(authController.logout));
authRoutes.get('/me', authenticate, asyncHandler(authController.me));
