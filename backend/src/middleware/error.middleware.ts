import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error({ err }, 'Application error');
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Map common Prisma errors to friendly responses.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with these details already exists' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
      return;
    }
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      ...(env.isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
    },
  });
}

/** Wrap an async route handler so rejected promises reach the error middleware. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
