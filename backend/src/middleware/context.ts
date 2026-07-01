import { Request } from 'express';
import { AuditContext } from '../services/audit.service';

/** Extract the client IP, honouring a trusted proxy's X-Forwarded-For. */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}

/** Build an audit context from the authenticated request. */
export function auditContext(req: Request): AuditContext {
  return {
    userId: req.user?.id ?? null,
    actorEmail: req.user?.email ?? null,
    ipAddress: getClientIp(req) ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
