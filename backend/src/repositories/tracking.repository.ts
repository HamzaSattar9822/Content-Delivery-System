import { DeviceType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export class DeviceRepository {
  constructor(private readonly db = prisma) {}

  countForLink(linkId: string) {
    return this.db.device.count({ where: { linkId } });
  }

  findByFingerprint(linkId: string, fingerprint: string) {
    return this.db.device.findUnique({ where: { linkId_fingerprint: { linkId, fingerprint } } });
  }

  async upsert(data: {
    linkId: string;
    fingerprint: string;
    userAgent?: string;
    browser?: string;
    os?: string;
    deviceType?: DeviceType;
    ipAddress?: string;
  }) {
    return this.db.device.upsert({
      where: { linkId_fingerprint: { linkId: data.linkId, fingerprint: data.fingerprint } },
      update: { lastSeenAt: new Date(), ipAddress: data.ipAddress, userAgent: data.userAgent },
      create: {
        linkId: data.linkId,
        fingerprint: data.fingerprint,
        userAgent: data.userAgent,
        browser: data.browser,
        os: data.os,
        deviceType: data.deviceType ?? DeviceType.UNKNOWN,
        ipAddress: data.ipAddress,
      },
    });
  }
}

export class SessionRepository {
  constructor(private readonly db = prisma) {}

  findByKey(sessionKey: string) {
    return this.db.session.findUnique({ where: { sessionKey } });
  }

  countForLink(linkId: string) {
    return this.db.session.count({ where: { linkId } });
  }

  countActiveForLink(linkId: string, since: Date) {
    return this.db.session.count({
      where: { linkId, active: true, lastSeenAt: { gte: since } },
    });
  }

  create(data: Prisma.SessionCreateInput) {
    return this.db.session.create({ data });
  }

  touch(sessionKey: string) {
    return this.db.session.update({
      where: { sessionKey },
      data: { lastSeenAt: new Date() },
    });
  }

  end(sessionKey: string) {
    return this.db.session.update({
      where: { sessionKey },
      data: { active: false, endedAt: new Date() },
    });
  }
}

export class ViewLogRepository {
  constructor(private readonly db = prisma) {}

  create(data: Prisma.ViewLogCreateInput) {
    return this.db.viewLog.create({ data });
  }

  update(id: string, data: Prisma.ViewLogUpdateInput) {
    return this.db.viewLog.update({ where: { id }, data });
  }

  /** Latest saved watch position for a returning viewer on the same device. */
  findLatestProgress(linkId: string, deviceId: string) {
    return this.db.viewLog.findFirst({
      where: {
        linkId,
        deviceId,
        completed: false,
        watchSeconds: { gte: 5 },
      },
      orderBy: { createdAt: 'desc' },
      select: { watchSeconds: true },
    });
  }

  findBySessionId(sessionId: string) {
    return this.db.viewLog.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(filter: {
    linkId?: string;
    contentId?: string;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }) {
    const where: Prisma.ViewLogWhereInput = {};
    if (filter.linkId) where.linkId = filter.linkId;
    if (filter.contentId) where.contentId = filter.contentId;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }
    return Promise.all([
      this.db.viewLog.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
        include: { content: { select: { title: true } }, link: { select: { label: true } } },
      }),
      this.db.viewLog.count({ where }),
    ]);
  }
}
