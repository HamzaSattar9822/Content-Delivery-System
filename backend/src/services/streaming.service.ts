import bcrypt from 'bcryptjs';
import { Response } from 'express';
import { AccessLink, AuditAction, DeviceType, LinkStatus } from '@prisma/client';
import { UAParser } from 'ua-parser-js';
import { AccessLinkRepository } from '../repositories/link.repository';
import { DeviceRepository, SessionRepository, ViewLogRepository } from '../repositories/tracking.repository';
import {
  createStreamGrant,
  deviceFingerprint,
  generateSecureToken,
  sha256,
  verifyStreamGrant,
} from '../utils/crypto';
import { AccessDeniedError, BadRequestError, NotFoundError } from '../utils/errors';
import { env } from '../config/env';
import { AuditService } from './audit.service';
import { DriveService } from './drive.service';
import { NotificationService } from './notification.service';

export interface ViewerContext {
  ip?: string;
  userAgent?: string;
  referer?: string;
  origin?: string;
}

export interface AccessResult {
  content: {
    id: string;
    title: string;
    description: string | null;
    fileType: string;
    mimeType: string | null;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
  };
  sessionKey: string;
  streamUrl: string;
  remainingViews: number | null;
  expiresAt: Date | null;
  /** Seconds to seek to when resuming a prior incomplete watch on this device. */
  resumeAtSeconds: number | null;
}

const CONCURRENT_WINDOW_MS = 5 * 60 * 1000;

function parseUserAgent(ua?: string): { browser: string; os: string; deviceType: DeviceType } {
  const parsed = new UAParser(ua ?? '').getResult();
  const typeMap: Record<string, DeviceType> = {
    mobile: DeviceType.MOBILE,
    tablet: DeviceType.TABLET,
    smarttv: DeviceType.TV,
    console: DeviceType.TV,
  };
  const deviceType = parsed.device.type
    ? typeMap[parsed.device.type] ?? DeviceType.UNKNOWN
    : DeviceType.DESKTOP;
  return {
    browser: parsed.browser.name ?? 'Unknown',
    os: parsed.os.name ?? 'Unknown',
    deviceType,
  };
}

function hostFromUrl(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

/**
 * The access enforcement engine + secure streaming proxy. Google Drive URLs
 * are never exposed; viewers only ever receive CDS-signed stream grants.
 */
export class StreamingService {
  constructor(
    private readonly linkRepo: AccessLinkRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly viewLogRepo: ViewLogRepository,
    private readonly driveService: DriveService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  /** Metadata-only resolve used to render the watch page (does not consume a view). */
  async resolvePublicLink(token: string) {
    const link = await this.linkRepo.findByTokenHash(sha256(token));
    if (!link) throw new NotFoundError('This link does not exist');
    return {
      label: link.label,
      status: this.effectiveStatus(link),
      requiresPassword: Boolean(link.passwordHash),
      neverExpire: link.neverExpire,
      expiresAt: link.expiresAt,
      content: { title: link.content.title, fileType: link.content.fileType },
    };
  }

  private effectiveStatus(link: AccessLink): LinkStatus {
    if (link.status !== LinkStatus.ACTIVE) return link.status;
    if (!link.neverExpire && link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return LinkStatus.EXPIRED;
    }
    return LinkStatus.ACTIVE;
  }

  /**
   * Full access request: enforce all controls, record the view, create a
   * session/device, and return a short-lived signed stream grant.
   */
  async requestAccess(token: string, password: string | undefined, viewer: ViewerContext): Promise<AccessResult> {
    const link = await this.linkRepo.findByTokenHash(sha256(token));
    if (!link) throw new NotFoundError('This link does not exist');

    const deny = async (reason: string, code: string) => {
      await this.audit.record({
        action: AuditAction.ACCESS_DENIED,
        entityType: 'access_link',
        entityId: link.id,
        ipAddress: viewer.ip,
        userAgent: viewer.userAgent,
        metadata: { reason },
      });
      throw new AccessDeniedError(reason, code);
    };

    // --- status / expiration ---
    const kind = contentKindLabel(link.content.fileType);
    if (link.status === LinkStatus.REVOKED) {
      return deny(`This ${kind} has been revoked and is no longer available.`, 'LINK_REVOKED');
    }
    if (link.status === LinkStatus.DISABLED) {
      return deny(`This ${kind} is currently disabled.`, 'LINK_DISABLED');
    }

    if (this.effectiveStatus(link) === LinkStatus.EXPIRED) {
      if (link.status === LinkStatus.ACTIVE) {
        await this.linkRepo.update(link.id, { status: LinkStatus.EXPIRED });
        await this.notifications.notifyLinkExpired(link);
      }
      return deny('This link has expired and is no longer available.', 'LINK_EXPIRED');
    }

    // --- password ---
    if (link.passwordHash) {
      if (!password || !(await bcrypt.compare(password, link.passwordHash))) {
        return deny('Incorrect or missing password', 'PASSWORD_REQUIRED');
      }
    }

    // --- IP allowlist ---
    if (link.ipAllowlist.length && (!viewer.ip || !link.ipAllowlist.includes(viewer.ip))) {
      await this.notifications.notifySecurityEvent({
        message: `Blocked access to link "${link.label ?? link.id}" from disallowed IP ${viewer.ip ?? 'unknown'}.`,
        linkId: link.id,
        metadata: { ip: viewer.ip },
      });
      return deny('Access is not permitted from your network', 'IP_NOT_ALLOWED');
    }

    // --- domain allowlist (referer/origin host) ---
    if (link.domainAllowlist.length) {
      const host = hostFromUrl(viewer.origin) ?? hostFromUrl(viewer.referer);
      if (!host || !link.domainAllowlist.includes(host)) {
        return deny('Embedding is not permitted on this domain', 'DOMAIN_NOT_ALLOWED');
      }
    }

    // --- view limit (notify the admin only on the first time it is hit) ---
    if (link.maxViews != null && link.viewCount >= link.maxViews) {
      if (link.lastThresholdFired !== -1) {
        await this.notifications.notifyViewLimitExceeded(link);
        await this.linkRepo.update(link.id, { lastThresholdFired: -1 });
      }
      return deny('This link has reached its maximum number of views', 'VIEW_LIMIT_REACHED');
    }

    const ua = parseUserAgent(viewer.userAgent);
    const fingerprint = deviceFingerprint(link.id, viewer.ip, viewer.userAgent);

    // --- device limit (only blocks brand-new devices) ---
    if (link.maxDevices != null) {
      const existingDevice = await this.deviceRepo.findByFingerprint(link.id, fingerprint);
      if (!existingDevice) {
        const deviceCount = await this.deviceRepo.countForLink(link.id);
        if (deviceCount >= link.maxDevices) {
          return deny('This link has reached its maximum number of devices', 'DEVICE_LIMIT_REACHED');
        }
      }
    }

    // --- session limit ---
    if (link.maxSessions != null) {
      const sessionCount = await this.sessionRepo.countForLink(link.id);
      if (sessionCount >= link.maxSessions) {
        return deny('This link has reached its maximum number of sessions', 'SESSION_LIMIT_REACHED');
      }
    }

    // --- concurrency limit ---
    if (link.maxConcurrent != null) {
      const active = await this.sessionRepo.countActiveForLink(link.id, new Date(Date.now() - CONCURRENT_WINDOW_MS));
      if (active >= link.maxConcurrent) {
        return deny('Too many people are watching this right now. Please try again later.', 'CONCURRENCY_LIMIT_REACHED');
      }
    }

    // --- passed all checks: record device, session, view ---
    const device = await this.deviceRepo.upsert({
      linkId: link.id,
      fingerprint,
      userAgent: viewer.userAgent,
      browser: ua.browser,
      os: ua.os,
      deviceType: ua.deviceType,
      ipAddress: viewer.ip,
    });

    const sessionKey = generateSecureToken(24);
    const session = await this.sessionRepo.create({
      sessionKey,
      link: { connect: { id: link.id } },
      device: { connect: { id: device.id } },
      ipAddress: viewer.ip,
      userAgent: viewer.userAgent,
    });

    const priorProgress = await this.viewLogRepo.findLatestProgress(link.id, device.id);
    let resumeAtSeconds: number | null = priorProgress?.watchSeconds ?? null;
    const duration = link.content.durationSeconds;
    if (resumeAtSeconds != null && duration != null && duration > 0) {
      const pct = (resumeAtSeconds / duration) * 100;
      if (pct >= 95) resumeAtSeconds = null;
    }

    await this.viewLogRepo.create({
      link: { connect: { id: link.id } },
      content: { connect: { id: link.contentId } },
      session: { connect: { id: session.id } },
      device: { connect: { id: device.id } },
      ipAddress: viewer.ip,
      userAgent: viewer.userAgent,
      browser: ua.browser,
      os: ua.os,
      deviceType: ua.deviceType,
      referer: viewer.referer,
    });

    const updated = await this.linkRepo.incrementViewCount(link.id);
    await this.audit.record({
      action: AuditAction.LINK_ACCESS,
      entityType: 'access_link',
      entityId: link.id,
      ipAddress: viewer.ip,
      userAgent: viewer.userAgent,
    });
    await this.notifications.evaluateViewThresholds(updated);

    const grant = createStreamGrant({ linkId: link.id, sessionKey }, 3600);
    return {
      content: {
        id: link.content.id,
        title: link.content.title,
        description: link.content.description,
        fileType: link.content.fileType,
        mimeType: link.content.mimeType,
        durationSeconds: link.content.durationSeconds,
        thumbnailUrl: link.content.thumbnailUrl,
      },
      sessionKey,
      streamUrl: `${env.APP_URL}/api/v1/public/stream?grant=${encodeURIComponent(grant)}`,
      remainingViews: updated.maxViews == null ? null : Math.max(0, updated.maxViews - updated.viewCount),
      expiresAt: link.expiresAt,
      resumeAtSeconds,
    };
  }

  /** Stream the underlying Drive file through the backend with Range support. */
  async stream(grantToken: string, range: string | undefined, res: Response): Promise<void> {
    const grant = verifyStreamGrant(grantToken);
    if (!grant) throw new AccessDeniedError('Stream grant is invalid or expired', 'GRANT_INVALID');

    const session = await this.sessionRepo.findByKey(grant.sessionKey);
    if (!session || !session.active) throw new AccessDeniedError('Session is no longer active', 'SESSION_ENDED');

    const link = await this.linkRepo.findById(grant.linkId);
    if (!link) throw new NotFoundError('Content not found');
    const status = this.effectiveStatus(link as unknown as AccessLink);
    if (status === LinkStatus.REVOKED) {
      throw new AccessDeniedError(
        `This ${contentKindLabel(link.content.fileType)} has been revoked and is no longer available.`,
        'LINK_REVOKED',
      );
    }
    if (status === LinkStatus.EXPIRED) {
      throw new AccessDeniedError('This link has expired and is no longer available.', 'LINK_EXPIRED');
    }
    if (status !== LinkStatus.ACTIVE) {
      throw new AccessDeniedError('This link is no longer active.', 'LINK_INACTIVE');
    }

    await this.sessionRepo.touch(grant.sessionKey);

    const driveResponse = await this.driveService.streamFile(link.content.googleDriveFileId, range);

    res.status(driveResponse.status === 206 || range ? 206 : 200);
    if (driveResponse.headers['content-type']) res.setHeader('Content-Type', driveResponse.headers['content-type']!);
    if (driveResponse.headers['content-length']) res.setHeader('Content-Length', driveResponse.headers['content-length']!);
    if (driveResponse.headers['content-range']) res.setHeader('Content-Range', driveResponse.headers['content-range']!);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    // Allow LMS / iframe embedding (outer watch page + nested PDF iframe).
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prefer inline display for PDFs inside iframes instead of download prompts.
    const contentType = String(driveResponse.headers['content-type'] ?? link.content.mimeType ?? '');
    if (contentType.includes('pdf') || link.content.fileType === 'PDF') {
      res.setHeader('Content-Disposition', 'inline');
    }

    driveResponse.stream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    driveResponse.stream.pipe(res);
  }

  /** Viewer heartbeat: keep the session alive and accumulate watch progress. */
  async heartbeat(
    token: string,
    input: {
      sessionKey: string;
      watchSeconds?: number;
      watchPercentage?: number;
      completed?: boolean;
      event?: 'play' | 'pause' | 'stop' | 'progress' | 'ended' | 'replay';
    },
  ): Promise<void> {
    const link = await this.linkRepo.findByTokenHash(sha256(token));
    if (!link) throw new NotFoundError('This link does not exist');
    const session = await this.sessionRepo.findByKey(input.sessionKey);
    if (!session || session.linkId !== link.id) throw new BadRequestError('Invalid session');

    await this.sessionRepo.touch(input.sessionKey);

    const sessionLog = await this.viewLogRepo.findBySessionId(session.id);
    if (sessionLog && input.watchSeconds != null) {
      await this.viewLogRepo.update(sessionLog.id, {
        watchSeconds: Math.max(sessionLog.watchSeconds, Math.floor(input.watchSeconds)),
        completed: Boolean(input.completed) || sessionLog.completed,
      });
    }

    if (input.event && input.event !== 'progress') {
      await this.audit.record({
        action: AuditAction.LINK_ACCESS,
        entityType: 'access_link',
        entityId: link.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        metadata: {
          playerEvent: input.event,
          watchSeconds: input.watchSeconds,
          watchPercentage: input.watchPercentage,
        },
      });
    }
  }

  async endSession(sessionKey: string): Promise<void> {
    const session = await this.sessionRepo.findByKey(sessionKey);
    if (session) await this.sessionRepo.end(sessionKey);
  }
}

function contentKindLabel(fileType: string | null | undefined): string {
  switch (fileType) {
    case 'VIDEO':
      return 'video';
    case 'AUDIO':
      return 'audio';
    case 'PDF':
      return 'PDF';
    case 'IMAGE':
      return 'image';
    default:
      return 'content';
  }
}
