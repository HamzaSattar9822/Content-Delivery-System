import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';

type Source = 'body' | 'query' | 'params';

/** Validate (and coerce) a request section against a Zod schema. */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new ValidationError('Request validation failed', result.error.flatten().fieldErrors));
      return;
    }
    // Assign coerced/validated values back (query/params are read-only getters
    // on some Express versions, so guard the assignment).
    if (source === 'body') req.body = result.data;
    else (req as unknown as Record<string, unknown>)[`validated_${source}`] = result.data;
    next();
  };
}

/** Read validated query/params back out (set by `validate`). */
export function validated<T>(req: Request, source: 'query' | 'params'): T {
  return ((req as unknown as Record<string, unknown>)[`validated_${source}`] ?? req[source]) as T;
}
