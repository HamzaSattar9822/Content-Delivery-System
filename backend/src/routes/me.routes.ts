import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { ok } from '../utils/http';

/**
 * Returns the current app user (identity + RBAC role/permissions) for a valid
 * Better Auth session. The frontend uses this to hydrate its auth context and
 * drive permission-based UI. Better Auth's own session endpoints live under
 * /api/auth/*.
 */
export const meRoutes = Router();

meRoutes.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    ok(res, { user: req.user });
  }),
);
