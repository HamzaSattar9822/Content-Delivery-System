import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginated } from '../src/utils/http';
import { mimeToFileType } from '../src/services/drive.service';

describe('pagination helpers', () => {
  it('applies sensible defaults', () => {
    const p = parsePagination({});
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(20);
    expect(p.skip).toBe(0);
  });

  it('computes skip from page', () => {
    const p = parsePagination({ page: '3', pageSize: '10' });
    expect(p.skip).toBe(20);
    expect(p.take).toBe(10);
  });

  it('caps the page size at 100', () => {
    const p = parsePagination({ pageSize: '5000' });
    expect(p.pageSize).toBe(100);
  });

  it('builds pagination metadata', () => {
    const result = buildPaginated([1, 2, 3], 45, { page: 2, pageSize: 20 });
    expect(result.pagination.total).toBe(45);
    expect(result.pagination.totalPages).toBe(3);
  });
});

describe('mime to file type mapping', () => {
  it('maps known mime types to the generic content model', () => {
    expect(mimeToFileType('video/mp4')).toBe('VIDEO');
    expect(mimeToFileType('audio/mpeg')).toBe('AUDIO');
    expect(mimeToFileType('image/png')).toBe('IMAGE');
    expect(mimeToFileType('application/pdf')).toBe('PDF');
    expect(mimeToFileType('application/zip')).toBe('ZIP');
    expect(mimeToFileType('application/octet-stream')).toBe('OTHER');
  });
});
