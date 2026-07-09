import { Request, Response } from 'express';
import { container } from '../container';
import { ok, created, noContent } from '../utils/http';
import { auditContext } from '../middleware/context';

const { contentService } = container.services;

export const contentController = {
  async list(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.list(req.query as Record<string, unknown>));
  },

  async get(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.getById(req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const content = await contentService.create(req.body, auditContext(req));
    created(res, content);
  },

  async update(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.update(req.params.id, req.body, auditContext(req)));
  },

  async archive(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.archive(req.params.id, auditContext(req)));
  },

  async restore(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.restore(req.params.id, auditContext(req)));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await contentService.remove(req.params.id, auditContext(req));
    noContent(res);
  },
};
