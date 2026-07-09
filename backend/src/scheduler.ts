import { container } from './container';
import { logger } from './utils/logger';

const { linkRepo } = container.repositories;
const { notificationService } = container.services;

/**
 * Background access-enforcement sweep: expires overdue links and fires the
 * matching "link expired" notifications. Runs on an interval inside the API
 * process (sufficient for an MVP/single VPS deployment).
 */
export function startScheduler(intervalMs = 60 * 1000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const expiredIds = await linkRepo.expireOverdue();
      for (const id of expiredIds) {
        const link = await linkRepo.findById(id);
        if (link) await notificationService.notifyLinkExpired(link as never);
      }
      if (expiredIds.length) {
        logger.info({ count: expiredIds.length }, 'Expired overdue links');
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler tick failed');
    }
  };

  // Kick once shortly after boot, then on the interval.
  const timer = setInterval(tick, intervalMs);
  setTimeout(tick, 5000).unref();
  return timer;
}
