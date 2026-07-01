import { AuditAction, Prisma } from '@prisma/client';
import { AuditLogRepository } from '../repositories/audit.repository';
import { logger } from '../utils/logger';

export interface AuditContext {
  userId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry extends AuditContext {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly auditRepo: AuditLogRepository) {}

  /** Fire-and-forget audit write; never throws into the request path. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepo.create({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ipAddress: entry.ipAddress ?? undefined,
        userAgent: entry.userAgent ?? undefined,
        actorEmail: entry.actorEmail ?? undefined,
        metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
        user: entry.userId ? { connect: { id: entry.userId } } : undefined,
      });
    } catch (err) {
      logger.error({ err, action: entry.action }, 'Failed to write audit log');
    }
  }

  list(filter: Parameters<AuditLogRepository['list']>[0]) {
    return this.auditRepo.list(filter);
  }
}
