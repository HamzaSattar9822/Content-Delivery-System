import { describe, it, expect, vi, afterEach } from 'vitest';

describe('env URL coercion', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses RENDER_EXTERNAL_URL when APP_URL is empty', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/db');
    vi.stubEnv('JWT_ACCESS_SECRET', 'test-access-secret-12345678');
    vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-12345678');
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('FRONTEND_URL', 'https://cds.example.com');
    vi.stubEnv('RENDER_EXTERNAL_URL', 'https://cds-backend.onrender.com');

    const { env } = await import('../src/config/env');
    expect(env.APP_URL).toBe('https://cds-backend.onrender.com');
  });

  it('prefixes https for bare hostnames', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/db');
    vi.stubEnv('JWT_ACCESS_SECRET', 'test-access-secret-12345678');
    vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-12345678');
    vi.stubEnv('APP_URL', 'https://api.example.com');
    vi.stubEnv('FRONTEND_URL', 'my-app.vercel.app');

    const { env } = await import('../src/config/env');
    expect(env.FRONTEND_URL).toBe('https://my-app.vercel.app');
  });

  it('falls back LINK_SIGNING_SECRET to JWT_REFRESH_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/db');
    vi.stubEnv('JWT_ACCESS_SECRET', 'test-access-secret-12345678');
    vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-12345678');
    vi.stubEnv('APP_URL', 'http://localhost:4000');
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    vi.stubEnv('LINK_SIGNING_SECRET', '');

    const { env } = await import('../src/config/env');
    expect(env.LINK_SIGNING_SECRET).toBe('test-refresh-secret-12345678');
  });

  it('ignores empty APP_URL so RENDER_EXTERNAL_URL is used', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/db');
    vi.stubEnv('JWT_ACCESS_SECRET', 'test-access-secret-12345678');
    vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-12345678');
    vi.stubEnv('APP_URL', '   ');
    vi.stubEnv('FRONTEND_URL', 'https://cds.example.com');
    vi.stubEnv('RENDER_EXTERNAL_URL', 'https://cds-backend.onrender.com');

    const { env } = await import('../src/config/env');
    expect(env.APP_URL).toBe('https://cds-backend.onrender.com');
  });
});
