import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { PermissionKey } from '../config/permissions';

const ACCESS_COOKIE = 'cds_access_token';

/** Extract a bearer token from the Authorization header or the access cookie. */
function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  return cookieToken;
}

/** Require a valid access token; populates req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      name: null,
      avatarUrl: null,
      status: 'ACTIVE',
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
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

export const ACCESS_COOKIE_NAME = ACCESS_COOKIE;
