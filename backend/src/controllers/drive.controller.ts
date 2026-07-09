import { Request, Response } from 'express';
import { container } from '../container';
import { ok } from '../utils/http';

const { driveService } = container.services;

export const driveController = {
  async status(_req: Request, res: Response): Promise<void> {
    ok(res, { configured: driveService.isConfigured });
  },

  /** Browse a Drive folder (defaults to configured root). */
  async browse(req: Request, res: Response): Promise<void> {
    const folderId = req.query.folderId ? String(req.query.folderId) : undefined;
    ok(res, { files: await driveService.listChildren(folderId) });
  },

  async getFile(req: Request, res: Response): Promise<void> {
    ok(res, await driveService.getFile(req.params.fileId));
  },
};
