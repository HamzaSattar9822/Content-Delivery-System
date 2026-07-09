import { Request, Response } from 'express';
import { LinkStatus } from '@prisma/client';
import { container } from '../container';
import { ok, created, noContent } from '../utils/http';
import { auditContext } from '../middleware/context';

const { linkService } = container.services;

export const linkController = {
  async list(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.list(req.query as Record<string, unknown>));
  },

  async get(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.getById(req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const result = await linkService.create(req.body, auditContext(req));
    created(res, {
      id: result.link.id,
      token: result.token,
      watchUrl: result.watchUrl,
      embedUrl: result.embedUrl,
      embedCode: result.embedCode,
      link: { ...result.link, tokenHash: undefined },
    });
  },

  async update(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.update(req.params.id, req.body, auditContext(req)));
  },

  async disable(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.setStatus(req.params.id, LinkStatus.DISABLED, auditContext(req)));
  },

  async enable(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.setStatus(req.params.id, LinkStatus.ACTIVE, auditContext(req)));
  },

  async revoke(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.setStatus(req.params.id, LinkStatus.REVOKED, auditContext(req)));
  },

  async extend(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.extendExpiration(req.params.id, req.body.expiresAt, auditContext(req)));
  },

  async increaseViews(req: Request, res: Response): Promise<void> {
    ok(res, await linkService.increaseViewLimit(req.params.id, req.body.maxViews, auditContext(req)));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await linkService.remove(req.params.id, auditContext(req));
    noContent(res);
  },
};
