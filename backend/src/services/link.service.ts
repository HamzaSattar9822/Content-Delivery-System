import bcrypt from 'bcryptjs';
import { AuditAction, LinkStatus, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AccessLinkRepository, LinkListFilter } from '../repositories/link.repository';
import { ContentRepository } from '../repositories/content.repository';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { generateSecureToken, sha256 } from '../utils/crypto';
import { parsePagination, buildPaginated } from '../utils/http';
import { AuditService, AuditContext } from './audit.service';

export interface CreateLinkInput {
  contentId: string;
  label?: string;
  neverExpire?: boolean;
  expiresAt?: string | null;
  maxViews?: number | null;
  maxSessions?: number | null;
  maxDevices?: number | null;
  maxConcurrent?: number | null;
  password?: string | null;
  ipAllowlist?: string[];
  domainAllowlist?: string[];
}

export interface CreatedLink {
  link: Awaited<ReturnType<AccessLinkRepository['create']>>;
  token: string;
  watchUrl: string;
}

export class LinkService {
  constructor(
    private readonly linkRepo: AccessLinkRepository,
    private readonly contentRepo: ContentRepository,
    private readonly audit: AuditService,
  ) {}

  buildWatchUrl(token: string): string {
    return `${env.FRONTEND_URL}/watch/${token}`;
  }

  async list(query: Record<string, unknown>) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const sortField = String(query.sortBy ?? 'createdAt');
    const sortDir = String(query.sortDir ?? 'desc') === 'asc' ? 'asc' : 'desc';
    const allowed = ['createdAt', 'expiresAt', 'viewCount'];
    const orderBy = { [allowed.includes(sortField) ? sortField : 'createdAt']: sortDir } as LinkListFilter['orderBy'];

    const [data, total] = await this.linkRepo.list({
      skip,
      take,
      search: query.search ? String(query.search) : undefined,
      status: query.status as LinkStatus | undefined,
      contentId: query.contentId ? String(query.contentId) : undefined,
      orderBy,
    });
    return buildPaginated(this.decorate(data), total, { page, pageSize });
  }

  async getById(id: string) {
    const link = await this.linkRepo.findById(id);
    if (!link) throw new NotFoundError('Link not found');
    return this.decorateOne(link);
  }

  async create(input: CreateLinkInput, ctx: AuditContext): Promise<CreatedLink> {
    const content = await this.contentRepo.findById(input.contentId);
    if (!content) throw new NotFoundError('Content not found');

    if (!input.neverExpire && !input.expiresAt) {
      throw new BadRequestError('Provide an expiration date or set neverExpire to true');
    }

    const token = generateSecureToken(32);
    const data: Prisma.AccessLinkCreateInput = {
      tokenHash: sha256(token),
      label: input.label,
      content: { connect: { id: input.contentId } },
      createdBy: ctx.userId ? { connect: { id: ctx.userId } } : undefined,
      neverExpire: input.neverExpire ?? false,
      expiresAt: input.neverExpire ? null : input.expiresAt ? new Date(input.expiresAt) : null,
      maxViews: input.maxViews ?? null,
      maxSessions: input.maxSessions ?? null,
      maxDevices: input.maxDevices ?? null,
      maxConcurrent: input.maxConcurrent ?? null,
      passwordHash: input.password ? await bcrypt.hash(input.password, 10) : null,
      ipAllowlist: input.ipAllowlist ?? [],
      domainAllowlist: input.domainAllowlist ?? [],
    };

    const link = await this.linkRepo.create(data);
    await this.audit.record({
      ...ctx,
      action: AuditAction.LINK_CREATE,
      entityType: 'access_link',
      entityId: link.id,
      metadata: { contentId: input.contentId, label: input.label },
    });

    // The raw token is returned exactly once; only its hash is persisted.
    return { link, token, watchUrl: this.buildWatchUrl(token) };
  }

  async update(id: string, input: Partial<CreateLinkInput>, ctx: AuditContext) {
    await this.getById(id);
    const data: Prisma.AccessLinkUpdateInput = {
      label: input.label,
      maxViews: input.maxViews,
      maxSessions: input.maxSessions,
      maxDevices: input.maxDevices,
      maxConcurrent: input.maxConcurrent,
      ipAllowlist: input.ipAllowlist,
      domainAllowlist: input.domainAllowlist,
    };
    if (input.neverExpire !== undefined) {
      data.neverExpire = input.neverExpire;
      data.expiresAt = input.neverExpire ? null : input.expiresAt ? new Date(input.expiresAt) : undefined;
    } else if (input.expiresAt !== undefined) {
      data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }
    if (input.password !== undefined) {
      data.passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;
    }
    const link = await this.linkRepo.update(id, data);
    await this.audit.record({ ...ctx, action: AuditAction.LINK_UPDATE, entityType: 'access_link', entityId: id });
    return this.decorateOne(link);
  }

  async extendExpiration(id: string, expiresAt: string, ctx: AuditContext) {
    await this.getById(id);
    const link = await this.linkRepo.update(id, {
      expiresAt: new Date(expiresAt),
      neverExpire: false,
      status: LinkStatus.ACTIVE,
    });
    await this.audit.record({
      ...ctx,
      action: AuditAction.LINK_UPDATE,
      entityType: 'access_link',
      entityId: id,
      metadata: { extendedTo: expiresAt },
    });
    return this.decorateOne(link);
  }

  async increaseViewLimit(id: string, maxViews: number | null, ctx: AuditContext) {
    await this.getById(id);
    const link = await this.linkRepo.update(id, { maxViews });
    await this.audit.record({
      ...ctx,
      action: AuditAction.LINK_UPDATE,
      entityType: 'access_link',
      entityId: id,
      metadata: { maxViews },
    });
    return this.decorateOne(link);
  }

  async setStatus(id: string, status: LinkStatus, ctx: AuditContext) {
    await this.getById(id);
    const link = await this.linkRepo.update(id, {
      status,
      revokedAt: status === LinkStatus.REVOKED ? new Date() : null,
    });
    const action = status === LinkStatus.REVOKED ? AuditAction.LINK_REVOKE : AuditAction.LINK_UPDATE;
    await this.audit.record({ ...ctx, action, entityType: 'access_link', entityId: id, metadata: { status } });
    return this.decorateOne(link);
  }

  async remove(id: string, ctx: AuditContext) {
    await this.getById(id);
    await this.linkRepo.delete(id);
    await this.audit.record({ ...ctx, action: AuditAction.LINK_DELETE, entityType: 'access_link', entityId: id });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private decorate(links: any[]) {
    return links.map((l) => this.decorateOne(l));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private decorateOne(link: any) {
    const remainingViews =
      link.maxViews == null ? null : Math.max(0, link.maxViews - link.viewCount);
    return {
      ...link,
      hasPassword: Boolean(link.passwordHash),
      passwordHash: undefined,
      tokenHash: undefined,
      remainingViews,
    };
  }
}
