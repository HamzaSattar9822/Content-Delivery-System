import { Request, Response } from 'express';
import { container } from '../container';
import { ok } from '../utils/http';
import { auditContext } from '../middleware/context';

const { settingService } = container.services;

export const settingController = {
  async list(_req: Request, res: Response): Promise<void> {
    ok(res, await settingService.list());
  },
  async get(req: Request, res: Response): Promise<void> {
    ok(res, await settingService.get(req.params.key));
  },
  async update(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await settingService.set(req.params.key, req.body.value, req.body.description, auditContext(req)),
    );
  },
};
