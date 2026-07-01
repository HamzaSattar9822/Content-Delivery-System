import { Request, Response } from 'express';
import { NotificationStatus, NotificationType } from '@prisma/client';
import { container } from '../container';
import { ok, created, noContent } from '../utils/http';
import { parsePagination, buildPaginated } from '../utils/http';

const { notificationService } = container.services;

export const notificationController = {
  async listNotifications(req: Request, res: Response): Promise<void> {
    const { skip, take, page, pageSize } = parsePagination(req.query as Record<string, unknown>);
    const [data, total] = await notificationService.listNotifications({
      skip,
      take,
      type: req.query.type as NotificationType | undefined,
      status: req.query.status as NotificationStatus | undefined,
    });
    ok(res, buildPaginated(data, total, { page, pageSize }));
  },

  async listRules(req: Request, res: Response): Promise<void> {
    const linkId = req.query.linkId ? String(req.query.linkId) : undefined;
    ok(res, await notificationService.listRules(linkId));
  },

  async createRule(req: Request, res: Response): Promise<void> {
    created(res, await notificationService.createRule(req.body));
  },

  async updateRule(req: Request, res: Response): Promise<void> {
    ok(res, await notificationService.updateRule(req.params.id, req.body));
  },

  async deleteRule(req: Request, res: Response): Promise<void> {
    await notificationService.deleteRule(req.params.id);
    noContent(res);
  },
};
