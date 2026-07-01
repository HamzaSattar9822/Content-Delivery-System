import { Request, Response } from 'express';
import { AuditAction } from '@prisma/client';
import { container } from '../container';
import { ok, parsePagination, buildPaginated } from '../utils/http';

const { auditService } = container.services;

export const auditController = {
  async list(req: Request, res: Response): Promise<void> {
    const { skip, take, page, pageSize } = parsePagination(req.query as Record<string, unknown>);
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const [data, total] = await auditService.list({
      skip,
      take,
      search: req.query.search ? String(req.query.search) : undefined,
      action: req.query.action as AuditAction | undefined,
      userId: req.query.userId ? String(req.query.userId) : undefined,
      entityType: req.query.entityType ? String(req.query.entityType) : undefined,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    });
    ok(res, buildPaginated(data, total, { page, pageSize }));
  },
};
