import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app';

let app: Application;

beforeAll(() => {
  // Better Auth is initialised in server.ts; pass a no-op handler here so the
  // app builds without booting auth. NOTE: the auth-flow assertions below
  // (e.g. /api/v1/auth/config) target the old JWT system and need rewriting
  // for Better Auth (auth now lives at /api/auth/*).
  app = createApp((_req, _res) => {});
});

describe('API surface (no DB required)', () => {
  it('exposes a health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('reports auth configuration', async () => {
    const res = await request(app).get('/api/v1/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('googleOauthConfigured');
    expect(res.body.data).toHaveProperty('passwordAuthEnabled');
  });

  it('validates signup bodies', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({ email: 'bad', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates login bodies', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects protected routes without authentication', async () => {
    const res = await request(app).get('/api/v1/content');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/v1/links').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('validates request bodies', async () => {
    const res = await request(app).post('/api/v1/auth/dev-login').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('refuses streaming with an invalid grant', async () => {
    const res = await request(app).get('/api/v1/public/stream?grant=invalid');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GRANT_INVALID');
  });
});
