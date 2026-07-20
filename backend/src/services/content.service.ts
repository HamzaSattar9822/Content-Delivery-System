import { AuditAction, ContentStatus, FileType, Prisma } from '@prisma/client';
import { ContentRepository, ContentListFilter } from '../repositories/content.repository';
import { TagRepository } from '../repositories/taxonomy.repository';
import { NotFoundError } from '../utils/errors';
import { parsePagination, buildPaginated } from '../utils/http';
import { AuditService, AuditContext } from './audit.service';
import { DriveService, mimeToFileType } from './drive.service';

export interface CreateContentInput {
  title: string;
  description?: string;
  categoryId?: string;
  fileType?: FileType;
  googleDriveFileId: string;
  mimeType?: string;
  fileSize?: number;
  durationSeconds?: number;
  thumbnailUrl?: string;
  tags?: string[];
  status?: ContentStatus;
  syncFromDrive?: boolean;
}

export interface UpdateContentInput {
  title?: string;
  description?: string;
  categoryId?: string | null;
  fileType?: FileType;
  status?: ContentStatus;
  tags?: string[];
}

export class ContentService {
  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly tagRepo: TagRepository,
    private readonly driveService: DriveService,
    private readonly audit: AuditService,
  ) {}

  async list(query: Record<string, unknown>) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const sortField = String(query.sortBy ?? 'createdAt');
    const sortDir = String(query.sortDir ?? 'desc') === 'asc' ? 'asc' : 'desc';
    const allowedSort = ['createdAt', 'updatedAt', 'title', 'fileSize'];
    const orderBy = { [allowedSort.includes(sortField) ? sortField : 'createdAt']: sortDir } as ContentListFilter['orderBy'];

    const [data, total] = await this.contentRepo.list({
      skip,
      take,
      search: query.search ? String(query.search) : undefined,
      status: query.status as ContentStatus | undefined,
      fileType: query.fileType as FileType | undefined,
      categoryId: query.categoryId ? String(query.categoryId) : undefined,
      tag: query.tag ? String(query.tag) : undefined,
      orderBy,
    });
    return buildPaginated(data, total, { page, pageSize });
  }

  async getById(id: string) {
    const content = await this.contentRepo.findById(id);
    if (!content) throw new NotFoundError('Content not found');
    return content;
  }

  async create(input: CreateContentInput, ctx: AuditContext) {
    // Reuse an existing library entry for the same Drive file so link-create /
    // Drive-browse flows stay idempotent instead of duplicating rows.
    const existing = await this.contentRepo.findByGoogleDriveFileId(input.googleDriveFileId);
    if (existing) return existing;

    let { fileType, mimeType, fileSize, durationSeconds, thumbnailUrl, title } = input;

    // Optionally enrich metadata directly from Google Drive.
    if (input.syncFromDrive && this.driveService.isConfigured) {
      const meta = await this.driveService.getFile(input.googleDriveFileId);
      mimeType = mimeType ?? meta.mimeType;
      fileSize = fileSize ?? meta.size;
      thumbnailUrl = thumbnailUrl ?? meta.thumbnailLink;
      durationSeconds = durationSeconds ?? (meta.videoDurationMs ? Math.round(meta.videoDurationMs / 1000) : undefined);
      fileType = fileType ?? (mimeToFileType(meta.mimeType) as FileType);
      if (!title) title = meta.name;
    }

    const data: Prisma.ContentCreateInput = {
      title,
      description: input.description,
      fileType: fileType ?? FileType.VIDEO,
      mimeType,
      googleDriveFileId: input.googleDriveFileId,
      fileSize: BigInt(fileSize ?? 0),
      durationSeconds,
      thumbnailUrl,
      status: input.status ?? ContentStatus.ACTIVE,
      createdBy: ctx.userId ? { connect: { id: ctx.userId } } : undefined,
      category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
    };

    const content = await this.contentRepo.create(data);

    if (input.tags && input.tags.length) {
      const tagIds = await this.tagRepo.upsertMany(input.tags);
      await this.contentRepo.setTags(content.id, tagIds);
    }

    await this.audit.record({
      ...ctx,
      action: AuditAction.CONTENT_CREATE,
      entityType: 'content',
      entityId: content.id,
      metadata: {
        title: content.title,
        fileType: content.fileType,
        googleDriveFileId: content.googleDriveFileId,
      },
    });
    return this.contentRepo.findById(content.id);
  }

  async update(id: string, input: UpdateContentInput, ctx: AuditContext) {
    const existing = await this.getById(id);
    const data: Prisma.ContentUpdateInput = {
      title: input.title,
      description: input.description,
      fileType: input.fileType,
      status: input.status,
    };
    if (input.categoryId !== undefined) {
      data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
    }
    const content = await this.contentRepo.update(id, data);

    if (input.tags) {
      const tagIds = await this.tagRepo.upsertMany(input.tags);
      await this.contentRepo.setTags(id, tagIds);
    }

    await this.audit.record({
      ...ctx,
      action: AuditAction.CONTENT_UPDATE,
      entityType: 'content',
      entityId: id,
      metadata: {
        title: content.title ?? existing.title,
        changes: Object.keys(input),
      },
    });
    return this.contentRepo.findById(content.id);
  }

  async archive(id: string, ctx: AuditContext) {
    await this.getById(id);
    const content = await this.contentRepo.update(id, {
      status: ContentStatus.ARCHIVED,
      archivedAt: new Date(),
    });
    await this.audit.record({
      ...ctx,
      action: AuditAction.CONTENT_ARCHIVE,
      entityType: 'content',
      entityId: id,
      metadata: { title: content.title },
    });
    return content;
  }

  async restore(id: string, ctx: AuditContext) {
    await this.getById(id);
    const content = await this.contentRepo.update(id, {
      status: ContentStatus.ACTIVE,
      archivedAt: null,
    });
    await this.audit.record({
      ...ctx,
      action: AuditAction.CONTENT_RESTORE,
      entityType: 'content',
      entityId: id,
      metadata: { title: content.title },
    });
    return content;
  }

  async remove(id: string, ctx: AuditContext) {
    const existing = await this.getById(id);
    await this.contentRepo.delete(id);
    await this.audit.record({
      ...ctx,
      action: AuditAction.CONTENT_DELETE,
      entityType: 'content',
      entityId: id,
      metadata: { title: existing.title, fileType: existing.fileType },
    });
  }
}
