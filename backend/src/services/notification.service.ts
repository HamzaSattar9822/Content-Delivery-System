import { AccessLink, NotificationType, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { NotificationRepository, NotificationRuleRepository } from '../repositories/notification.repository';
import { logger } from '../utils/logger';
import { Mailer } from './mailer';

export class NotificationService {
  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly ruleRepo: NotificationRuleRepository,
    private readonly mailer: Mailer,
  ) {}

  // ----- rules CRUD -----
  listRules(linkId?: string) {
    return this.ruleRepo.list(linkId);
  }

  createRule(data: {
    type: NotificationType;
    threshold?: number;
    linkId?: string;
    recipient?: string;
    enabled?: boolean;
  }) {
    return this.ruleRepo.create({
      type: data.type,
      threshold: data.threshold,
      recipient: data.recipient,
      enabled: data.enabled ?? true,
      link: data.linkId ? { connect: { id: data.linkId } } : undefined,
    });
  }

  updateRule(id: string, data: Prisma.NotificationRuleUpdateInput) {
    return this.ruleRepo.update(id, data);
  }

  deleteRule(id: string) {
    return this.ruleRepo.delete(id);
  }

  listNotifications(filter: Parameters<NotificationRepository['list']>[0]) {
    return this.notificationRepo.list(filter);
  }

  /** Create + attempt delivery of a single notification. */
  async dispatch(input: {
    type: NotificationType;
    title: string;
    message: string;
    recipient?: string;
    linkId?: string;
    contentId?: string;
    threshold?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const recipient = input.recipient || env.ALERT_DEFAULT_RECIPIENT;
    if (!recipient) {
      logger.warn({ type: input.type }, 'No notification recipient configured; skipping');
      return;
    }
    const notification = await this.notificationRepo.create({
      type: input.type,
      title: input.title,
      message: input.message,
      recipient,
      threshold: input.threshold,
      contentId: input.contentId,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      link: input.linkId ? { connect: { id: input.linkId } } : undefined,
    });

    try {
      await this.mailer.send({ to: recipient, subject: input.title, text: input.message });
      await this.notificationRepo.markSent(notification.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err }, 'Failed to send notification email');
      await this.notificationRepo.markFailed(notification.id, message);
    }
  }

  /**
   * Evaluate view-threshold rules after a view is recorded. Fires every newly
   * crossed threshold and records the highest fired threshold on the link to
   * guarantee each alert is sent at most once.
   */
  async evaluateViewThresholds(link: AccessLink): Promise<void> {
    const rules = await this.ruleRepo.findViewThresholdRules(link.id);
    if (rules.length === 0) return;

    const crossed = rules
      .map((r) => r.threshold as number)
      .filter((t) => t > link.lastThresholdFired && link.viewCount >= t)
      .sort((a, b) => a - b);

    if (crossed.length === 0) return;

    for (const threshold of crossed) {
      const rule = rules.find((r) => r.threshold === threshold);
      await this.dispatch({
        type: NotificationType.VIEW_THRESHOLD,
        title: `View threshold reached: ${threshold} views`,
        message: `Link "${link.label ?? link.id}" has reached ${link.viewCount} views (threshold ${threshold}).`,
        recipient: rule?.recipient ?? undefined,
        linkId: link.id,
        contentId: link.contentId,
        threshold,
      });
    }

    const highest = crossed[crossed.length - 1];
    await prisma.accessLink.update({
      where: { id: link.id },
      data: { lastThresholdFired: highest },
    });
  }

  async notifyViewLimitExceeded(link: AccessLink): Promise<void> {
    await this.dispatch({
      type: NotificationType.VIEW_LIMIT_EXCEEDED,
      title: 'View limit exceeded',
      message: `Link "${link.label ?? link.id}" has reached its maximum of ${link.maxViews} views and is now blocking access.`,
      linkId: link.id,
      contentId: link.contentId,
    });
  }

  async notifyLinkExpired(link: AccessLink): Promise<void> {
    await this.dispatch({
      type: NotificationType.LINK_EXPIRED,
      title: 'Delivery link expired',
      message: `Link "${link.label ?? link.id}" has expired and is no longer accessible.`,
      linkId: link.id,
      contentId: link.contentId,
    });
  }

  async notifySecurityEvent(input: { message: string; linkId?: string; metadata?: Record<string, unknown> }): Promise<void> {
    await this.dispatch({
      type: NotificationType.SECURITY_EVENT,
      title: 'Security event detected',
      message: input.message,
      linkId: input.linkId,
      metadata: input.metadata,
    });
  }
}
