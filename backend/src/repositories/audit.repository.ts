import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export class AuditLogRepository {
  constructor(private readonly db = prisma) {}

  create(data: Prisma.AuditLogCreateInput) {
    return this.db.auditLog.create({ data });
  }

  async list(filter: {
    search?: string;
    action?: AuditAction;
    userId?: string;
    entityType?: string;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.action) where.action = filter.action;
    if (filter.userId) where.userId = filter.userId;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }
    if (filter.search) {
      where.OR = [
        { actorEmail: { contains: filter.search, mode: 'insensitive' } },
        { entityId: { contains: filter.search, mode: 'insensitive' } },
        { entityType: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    return Promise.all([
      this.db.auditLog.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.db.auditLog.count({ where }),
    ]);
  }
}
