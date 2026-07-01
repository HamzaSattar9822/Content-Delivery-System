import { Request, Response } from 'express';
import { container } from '../container';
import { ok } from '../utils/http';
import { getClientIp } from '../middleware/context';
import { ViewerContext } from '../services/streaming.service';

const { streamingService } = container.services;

function viewerContext(req: Request): ViewerContext {
  return {
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer,
    origin: req.headers.origin,
  };
}

export const publicController = {
  /** Metadata for the watch page (no view consumed). */
  async resolve(req: Request, res: Response): Promise<void> {
    ok(res, await streamingService.resolvePublicLink(req.params.token));
  },

  /** Full access request: enforces all controls and returns a stream grant. */
  async access(req: Request, res: Response): Promise<void> {
    const result = await streamingService.requestAccess(
      req.params.token,
      req.body.password,
      viewerContext(req),
    );
    ok(res, result);
  },

  /** Secure streaming proxy with HTTP range support. */
  async stream(req: Request, res: Response): Promise<void> {
    const grant = String(req.query.grant ?? '');
    await streamingService.stream(grant, req.headers.range, res);
  },

  async heartbeat(req: Request, res: Response): Promise<void> {
    await streamingService.heartbeat(req.params.token, req.body);
    ok(res, { ok: true });
  },

  async end(req: Request, res: Response): Promise<void> {
    await streamingService.endSession(req.body.sessionKey);
    ok(res, { ended: true });
  },
};
