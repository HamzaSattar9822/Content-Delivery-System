import { Response } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const requested = Number.parseInt(String(query.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginated<T>(
  data: T[],
  total: number,
  params: Pick<PaginationParams, 'page' | 'pageSize'>,
): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    },
  };
}

export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * BigInt is not JSON-serialisable by default. Patch the prototype once so any
 * Prisma BigInt (e.g. fileSize) is emitted as a string in responses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function toJSON() {
  return this.toString();
};
