import { Request, Response } from 'express';
import { container } from '../container';
import { ok, created, noContent } from '../utils/http';

const { categoryRepo, tagRepo } = container.repositories;

export const categoryController = {
  async list(_req: Request, res: Response): Promise<void> {
    ok(res, await categoryRepo.list());
  },
  async create(req: Request, res: Response): Promise<void> {
    created(res, await categoryRepo.create(req.body));
  },
  async update(req: Request, res: Response): Promise<void> {
    ok(res, await categoryRepo.update(req.params.id, req.body));
  },
  async remove(req: Request, res: Response): Promise<void> {
    await categoryRepo.delete(req.params.id);
    noContent(res);
  },
};

export const tagController = {
  async list(_req: Request, res: Response): Promise<void> {
    ok(res, await tagRepo.list());
  },
};
