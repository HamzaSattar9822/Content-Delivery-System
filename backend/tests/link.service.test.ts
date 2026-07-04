import { describe, it, expect } from 'vitest';
import { LinkService } from '../src/services/link.service';

describe('LinkService embed helpers', () => {
  const service = new LinkService({} as never, {} as never, {} as never);
  const token = 'test-token-abc';

  it('builds watch URL from token', () => {
    expect(service.buildWatchUrl(token)).toMatch(/\/watch\/test-token-abc$/);
  });

  it('builds embed URL with embed=1 query', () => {
    expect(service.buildEmbedUrl(token)).toBe(`${service.buildWatchUrl(token)}?embed=1`);
  });

  it('builds iframe embed code pointing at embed URL', () => {
    const code = service.buildEmbedCode(token);
    expect(code).toContain(`src="${service.buildEmbedUrl(token)}"`);
    expect(code).toContain('<iframe');
    expect(code).toContain('allowfullscreen');
  });
});
