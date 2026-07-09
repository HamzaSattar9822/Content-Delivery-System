import { describe, it, expect, beforeEach, vi } from 'vitest';

// The threshold bookkeeping writes back via the shared prisma client; mock it.
vi.mock('../src/db/prisma', () => ({
  prisma: { accessLink: { update: vi.fn().mockResolvedValue({}) } },
}));

import { NotificationService } from '../src/services/notification.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

function buildService() {
  const notificationRepo = {
    create: vi.fn().mockResolvedValue({ id: 'n-1' }),
    markSent: vi.fn(),
    markFailed: vi.fn(),
    list: vi.fn(),
  };
  const ruleRepo = {
    findViewThresholdRules: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationService(notificationRepo as any, ruleRepo as any, mailer as any);
  return { service, notificationRepo, ruleRepo, mailer };
}

describe('NotificationService threshold evaluation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires every newly-crossed threshold once', async () => {
    const { service, ruleRepo, mailer } = buildService();
    ruleRepo.findViewThresholdRules.mockResolvedValue([
      { threshold: 100, recipient: 'a@example.com' },
      { threshold: 250, recipient: 'a@example.com' },
      { threshold: 500, recipient: 'a@example.com' },
    ]);

    const link: any = { id: 'link-1', label: 'L', contentId: 'c-1', viewCount: 260, lastThresholdFired: 0 };
    await service.evaluateViewThresholds(link);

    // 100 and 250 crossed, 500 not yet.
    expect(mailer.send).toHaveBeenCalledTimes(2);
  });

  it('does not refire thresholds already fired', async () => {
    const { service, ruleRepo, mailer } = buildService();
    ruleRepo.findViewThresholdRules.mockResolvedValue([
      { threshold: 100, recipient: 'a@example.com' },
      { threshold: 250, recipient: 'a@example.com' },
    ]);

    const link: any = { id: 'link-1', label: 'L', contentId: 'c-1', viewCount: 260, lastThresholdFired: 100 };
    await service.evaluateViewThresholds(link);

    // Only 250 should fire now.
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no rules exist', async () => {
    const { service, ruleRepo, mailer } = buildService();
    ruleRepo.findViewThresholdRules.mockResolvedValue([]);
    const link: any = { id: 'link-1', viewCount: 1000, lastThresholdFired: 0 };
    await service.evaluateViewThresholds(link);
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
