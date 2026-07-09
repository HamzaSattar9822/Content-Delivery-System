import { NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export class NotificationRepository {
  constructor(private readonly db = prisma) {}

  create(data: Prisma.NotificationCreateInput) {
    return this.db.notification.create({ data });
  }

  markSent(id: string) {
    return this.db.notification.update({
      where: { id },
      data: { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  }

  markFailed(id: string, error: string) {
    return this.db.notification.update({
      where: { id },
      data: { status: NotificationStatus.FAILED, error },
    });
  }

  async list(filter: {
    type?: NotificationType;
    status?: NotificationStatus;
    skip: number;
    take: number;
  }) {
    const where: Prisma.NotificationWhereInput = {};
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    return Promise.all([
      this.db.notification.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
        include: { link: { select: { id: true, label: true } } },
      }),
      this.db.notification.count({ where }),
    ]);
  }
}

export class NotificationRuleRepository {
  constructor(private readonly db = prisma) {}

  list(linkId?: string) {
    return this.db.notificationRule.findMany({
      where: linkId ? { OR: [{ linkId }, { linkId: null }] } : {},
      orderBy: [{ type: 'asc' }, { threshold: 'asc' }],
      include: { link: { select: { id: true, label: true } } },
    });
  }

  create(data: Prisma.NotificationRuleCreateInput) {
    return this.db.notificationRule.create({ data });
  }

  update(id: string, data: Prisma.NotificationRuleUpdateInput) {
    return this.db.notificationRule.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.db.notificationRule.delete({ where: { id } });
  }

  /** Active view-threshold rules applicable to a link (link-specific + global). */
  findViewThresholdRules(linkId: string) {
    return this.db.notificationRule.findMany({
      where: {
        type: NotificationType.VIEW_THRESHOLD,
        enabled: true,
        OR: [{ linkId }, { linkId: null }],
        threshold: { not: null },
      },
      orderBy: { threshold: 'asc' },
    });
  }
}
