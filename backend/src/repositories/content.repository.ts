import { Content, ContentStatus, FileType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export interface ContentListFilter {
  search?: string;
  status?: ContentStatus;
  fileType?: FileType;
  categoryId?: string;
  tag?: string;
  skip: number;
  take: number;
  orderBy?: Prisma.ContentOrderByWithRelationInput;
}

const contentInclude = {
  category: true,
  createdBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  _count: { select: { links: true, viewLogs: true } },
} satisfies Prisma.ContentInclude;

export class ContentRepository {
  constructor(private readonly db = prisma) {}

  findById(id: string) {
    return this.db.content.findUnique({ where: { id }, include: contentInclude });
  }

  findByGoogleDriveFileId(googleDriveFileId: string) {
    return this.db.content.findFirst({
      where: { googleDriveFileId, status: { not: ContentStatus.ARCHIVED } },
      include: contentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: Prisma.ContentCreateInput) {
    return this.db.content.create({ data, include: contentInclude });
  }

  update(id: string, data: Prisma.ContentUpdateInput) {
    return this.db.content.update({ where: { id }, data, include: contentInclude });
  }

  delete(id: string) {
    return this.db.content.delete({ where: { id } });
  }

  async list(filter: ContentListFilter): Promise<[Content[], number]> {
    const where: Prisma.ContentWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.fileType) where.fileType = filter.fileType;
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.tag) where.tags = { some: { tag: { slug: filter.tag } } };
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    return Promise.all([
      this.db.content.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: filter.orderBy ?? { createdAt: 'desc' },
        include: contentInclude,
      }),
      this.db.content.count({ where }),
    ]);
  }

  count(where: Prisma.ContentWhereInput = {}) {
    return this.db.content.count({ where });
  }

  setTags(contentId: string, tagIds: string[]) {
    return this.db.$transaction([
      this.db.contentTag.deleteMany({ where: { contentId } }),
      this.db.contentTag.createMany({
        data: tagIds.map((tagId) => ({ contentId, tagId })),
        skipDuplicates: true,
      }),
    ]);
  }
}
