import { Request, Response } from 'express';
import { container } from '../container';
import { ok } from '../utils/http';

const { analyticsService } = container.services;

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const analyticsController = {
  async dashboard(_req: Request, res: Response): Promise<void> {
    ok(res, await analyticsService.dashboard());
  },

  async detailed(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await analyticsService.detailed({
        linkId: req.query.linkId ? String(req.query.linkId) : undefined,
        contentId: req.query.contentId ? String(req.query.contentId) : undefined,
        from: parseDate(req.query.from),
        to: parseDate(req.query.to),
      }),
    );
  },

  async timeseries(req: Request, res: Response): Promise<void> {
    const days = Number.parseInt(String(req.query.days ?? '30'), 10) || 30;
    ok(res, await analyticsService.timeseries(days));
  },
};
