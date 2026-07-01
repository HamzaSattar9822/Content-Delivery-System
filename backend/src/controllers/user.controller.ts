import { Request, Response } from 'express';
import { container } from '../container';
import { ok, created, noContent } from '../utils/http';
import { auditContext } from '../middleware/context';

const { userService } = container.services;

export const userController = {
  async list(req: Request, res: Response): Promise<void> {
    ok(res, await userService.list(req.query as Record<string, unknown>));
  },
  async get(req: Request, res: Response): Promise<void> {
    ok(res, await userService.getById(req.params.id));
  },
  async create(req: Request, res: Response): Promise<void> {
    created(res, await userService.create(req.body, auditContext(req)));
  },
  async update(req: Request, res: Response): Promise<void> {
    ok(res, await userService.update(req.params.id, req.body, auditContext(req)));
  },
  async remove(req: Request, res: Response): Promise<void> {
    await userService.remove(req.params.id, auditContext(req));
    noContent(res);
  },
  async roles(_req: Request, res: Response): Promise<void> {
    ok(res, await userService.listRoles());
  },
};
