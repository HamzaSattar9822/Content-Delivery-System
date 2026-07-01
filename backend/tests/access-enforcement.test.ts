import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { StreamingService } from '../src/services/streaming.service';
import { AccessDeniedError } from '../src/utils/errors';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeLink(overrides: Record<string, any> = {}) {
  return {
    id: 'link-1',
    contentId: 'content-1',
    label: 'Test link',
    status: 'ACTIVE',
    neverExpire: true,
    expiresAt: null,
    passwordHash: null,
    ipAllowlist: [],
    domainAllowlist: [],
    maxViews: null,
    maxSessions: null,
    maxDevices: null,
    maxConcurrent: null,
    viewCount: 0,
    lastThresholdFired: 0,
    content: {
      id: 'content-1',
      title: 'Sample',
      description: null,
      fileType: 'VIDEO',
      mimeType: 'video/mp4',
      durationSeconds: null,
      thumbnailUrl: null,
      googleDriveFileId: 'gd-1',
    },
    ...overrides,
  };
}

function buildService(link: any) {
  const linkRepo = {
    findByTokenHash: vi.fn().mockResolvedValue(link),
    update: vi.fn().mockResolvedValue(link),
    incrementViewCount: vi.fn().mockResolvedValue({ ...link, viewCount: link.viewCount + 1 }),
    findById: vi.fn().mockResolvedValue(link),
  };
  const deviceRepo = {
    findByFingerprint: vi.fn().mockResolvedValue(null),
    countForLink: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue({ id: 'device-1' }),
  };
  const sessionRepo = {
    countForLink: vi.fn().mockResolvedValue(0),
    countActiveForLink: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'session-1' }),
    findByKey: vi.fn(),
    touch: vi.fn(),
    end: vi.fn(),
  };
  const viewLogRepo = {
    create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    list: vi.fn(),
    update: vi.fn(),
    findLatestProgress: vi.fn().mockResolvedValue(null),
    findBySessionId: vi.fn().mockResolvedValue({ id: 'log-1', watchSeconds: 0, completed: false }),
  };
  const driveService = { streamFile: vi.fn(), isConfigured: true } as any;
  const notifications = {
    notifyLinkExpired: vi.fn(),
    notifyViewLimitExceeded: vi.fn(),
    notifySecurityEvent: vi.fn(),
    evaluateViewThresholds: vi.fn(),
  } as any;
  const audit = { record: vi.fn() } as any;

  const service = new StreamingService(
    linkRepo as any,
    deviceRepo as any,
    sessionRepo as any,
    viewLogRepo as any,
    driveService,
    notifications,
    audit,
  );
  return { service, linkRepo, deviceRepo, sessionRepo, viewLogRepo, notifications, audit };
}

const viewer = { ip: '10.0.0.1', userAgent: 'Mozilla/5.0', referer: undefined, origin: undefined };

async function expectDenied(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AccessDeniedError);
  await promise.catch((err) => expect((err as AccessDeniedError).code).toBe(code));
}

describe('Access enforcement engine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grants access to a valid, unrestricted link', async () => {
    const { service, linkRepo, notifications } = buildService(makeLink());
    const result = await service.requestAccess('token', undefined, viewer);
    expect(result.sessionKey).toBeTruthy();
    expect(result.streamUrl).toContain('/api/v1/public/stream?grant=');
    expect(result.content.title).toBe('Sample');
    expect(linkRepo.incrementViewCount).toHaveBeenCalledWith('link-1');
    expect(notifications.evaluateViewThresholds).toHaveBeenCalled();
  });

  it('blocks a revoked link', async () => {
    const { service } = buildService(makeLink({ status: 'REVOKED' }));
    await expectDenied(service.requestAccess('token', undefined, viewer), 'LINK_REVOKED');
  });

  it('blocks a disabled link', async () => {
    const { service } = buildService(makeLink({ status: 'DISABLED' }));
    await expectDenied(service.requestAccess('token', undefined, viewer), 'LINK_DISABLED');
  });

  it('expires an overdue link and notifies the admin', async () => {
    const past = new Date(Date.now() - 1000);
    const { service, linkRepo, notifications } = buildService(
      makeLink({ neverExpire: false, expiresAt: past }),
    );
    await expectDenied(service.requestAccess('token', undefined, viewer), 'LINK_EXPIRED');
    expect(linkRepo.update).toHaveBeenCalledWith('link-1', { status: 'EXPIRED' });
    expect(notifications.notifyLinkExpired).toHaveBeenCalled();
  });

  it('enforces the maximum view limit', async () => {
    const { service, notifications } = buildService(makeLink({ maxViews: 50, viewCount: 50 }));
    await expectDenied(service.requestAccess('token', undefined, viewer), 'VIEW_LIMIT_REACHED');
    expect(notifications.notifyViewLimitExceeded).toHaveBeenCalled();
  });

  it('allows access while under the view limit and decrements remaining', async () => {
    // 49 prior views; this request consumes the 50th, leaving 0 remaining.
    const { service } = buildService(makeLink({ maxViews: 50, viewCount: 49 }));
    const result = await service.requestAccess('token', undefined, viewer);
    expect(result.remainingViews).toBe(0);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const { service } = buildService(makeLink({ passwordHash }));
    await expectDenied(service.requestAccess('token', 'wrong', viewer), 'PASSWORD_REQUIRED');
  });

  it('accepts a correct password', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const { service } = buildService(makeLink({ passwordHash }));
    const result = await service.requestAccess('token', 'correct-horse', viewer);
    expect(result.sessionKey).toBeTruthy();
  });

  it('enforces the IP allowlist', async () => {
    const { service } = buildService(makeLink({ ipAllowlist: ['203.0.113.9'] }));
    await expectDenied(service.requestAccess('token', undefined, viewer), 'IP_NOT_ALLOWED');
  });

  it('enforces the device limit for new devices', async () => {
    const { service, deviceRepo } = buildService(makeLink({ maxDevices: 2 }));
    deviceRepo.findByFingerprint.mockResolvedValue(null);
    deviceRepo.countForLink.mockResolvedValue(2);
    await expectDenied(service.requestAccess('token', undefined, viewer), 'DEVICE_LIMIT_REACHED');
  });

  it('enforces the session limit', async () => {
    const { service, sessionRepo } = buildService(makeLink({ maxSessions: 3 }));
    sessionRepo.countForLink.mockResolvedValue(3);
    await expectDenied(service.requestAccess('token', undefined, viewer), 'SESSION_LIMIT_REACHED');
  });

  it('enforces the concurrency limit', async () => {
    const { service, sessionRepo } = buildService(makeLink({ maxConcurrent: 1 }));
    sessionRepo.countActiveForLink.mockResolvedValue(1);
    await expectDenied(service.requestAccess('token', undefined, viewer), 'CONCURRENCY_LIMIT_REACHED');
  });

  it('enforces the domain allowlist for embedding', async () => {
    const { service } = buildService(makeLink({ domainAllowlist: ['lms.example.com'] }));
    await expectDenied(
      service.requestAccess('token', undefined, { ...viewer, origin: 'https://evil.example.org' }),
      'DOMAIN_NOT_ALLOWED',
    );
  });
});
