import { AccessLink, LinkStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export interface LinkListFilter {
  search?: string;
  status?: LinkStatus;
  /** When true and status is unset, hide soft-deleted links. */
  excludeDeleted?: boolean;
  contentId?: string;
  skip: number;
  take: number;
  orderBy?: Prisma.AccessLinkOrderByWithRelationInput;
}

const linkInclude = {
  content: { select: { id: true, title: true, fileType: true, googleDriveFileId: true, mimeType: true, fileSize: true, durationSeconds: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { viewLogs: true, sessions: true, devices: true } },
} satisfies Prisma.AccessLinkInclude;

export class AccessLinkRepository {
  constructor(private readonly db = prisma) {}

  findById(id: string) {
    return this.db.accessLink.findUnique({ where: { id }, include: linkInclude });
  }

  /** Lookup by the hashed token (used by the public watch endpoint). */
  findByTokenHash(tokenHash: string) {
    return this.db.accessLink.findUnique({
      where: { tokenHash },
      include: { content: true },
    });
  }

  create(data: Prisma.AccessLinkCreateInput) {
    return this.db.accessLink.create({ data, include: linkInclude });
  }

  update(id: string, data: Prisma.AccessLinkUpdateInput) {
    return this.db.accessLink.update({ where: { id }, data, include: linkInclude });
  }

  delete(id: string) {
    return this.db.accessLink.delete({ where: { id } });
  }

  /** Atomic view counter increment; returns the updated link. */
  incrementViewCount(id: string) {
    return this.db.accessLink.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  async list(filter: LinkListFilter): Promise<[AccessLink[], number]> {
    const where: Prisma.AccessLinkWhereInput = {};
    if (filter.status) {
      where.status = filter.status;
    } else if (filter.excludeDeleted) {
      where.status = { not: LinkStatus.DELETED };
    }
    if (filter.contentId) where.contentId = filter.contentId;
    if (filter.search) {
      where.OR = [
        { label: { contains: filter.search, mode: 'insensitive' } },
        { content: { title: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }
    return Promise.all([
      this.db.accessLink.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: filter.orderBy ?? { createdAt: 'desc' },
        include: linkInclude,
      }),
      this.db.accessLink.count({ where }),
    ]);
  }

  count(where: Prisma.AccessLinkWhereInput = {}) {
    return this.db.accessLink.count({ where });
  }

  /** Mark all links whose expiry has passed as EXPIRED. Returns affected count. */
  async expireOverdue(): Promise<string[]> {
    const overdue = await this.db.accessLink.findMany({
      where: {
        status: LinkStatus.ACTIVE,
        neverExpire: false,
        expiresAt: { not: null, lt: new Date() },
      },
      select: { id: true },
    });
    if (overdue.length === 0) return [];
    await this.db.accessLink.updateMany({
      where: { id: { in: overdue.map((l) => l.id) } },
      data: { status: LinkStatus.EXPIRED },
    });
    return overdue.map((l) => l.id);
  }
}
