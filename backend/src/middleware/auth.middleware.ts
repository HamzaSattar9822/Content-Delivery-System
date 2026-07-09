import { NextFunction, Request, Response } from 'express';
import { getAuth } from '../lib/auth';
import { container } from '../container';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { PermissionKey } from '../config/permissions';

/**
 * Convert Node request headers into the Web `Headers` object Better Auth expects.
 * Done inline (instead of importing `fromNodeHeaders` from the ESM-only
 * `better-auth/node`) so this hot-path middleware stays plain CommonJS.
 */
function toWebHeaders(nodeHeaders: Request['headers']): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, String(value));
    }
  }
  return headers;
}

/**
 * Require a valid Better Auth session, then hydrate `req.user` with the app's
 * RBAC data (role name + permission keys) resolved from the Role/Permission
 * tables. This keeps Better Auth as the identity source while preserving the
 * existing permission model.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await getAuth().api.getSession({ headers: toWebHeaders(req.headers) });
    if (!session?.user?.id) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const user = await container.repositories.userRepo.findById(session.user.id);
    if (!user) {
      next(new UnauthorizedError('User no longer exists'));
      return;
    }
    if (user.status !== 'ACTIVE') {
      next(new ForbiddenError('Account is suspended'));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
      name: user.name,
      avatarUrl: user.avatarUrl,
      status: user.status,
    };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      next(err);
      return;
    }
    next(new UnauthorizedError('Invalid or expired session'));
  }
}

/** Require that the authenticated user has all of the given permissions. */
export function requirePermissions(...required: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    const granted = new Set(req.user.permissions);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      next(new ForbiddenError(`Missing required permission(s): ${missing.join(', ')}`));
      return;
    }
    next();
  };
}

/** Require that the authenticated user has one of the given roles. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Your role does not permit this action'));
      return;
    }
    next();
  };
}
