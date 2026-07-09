/**
 * Composition root / dependency-injection container.
 * Instantiates repositories and services once and wires their dependencies.
 */
import { UserRepository } from './repositories/user.repository';
import { RoleRepository } from './repositories/role.repository';
import { ContentRepository } from './repositories/content.repository';
import { CategoryRepository, TagRepository } from './repositories/taxonomy.repository';
import { AccessLinkRepository } from './repositories/link.repository';
import { DeviceRepository, SessionRepository, ViewLogRepository } from './repositories/tracking.repository';
import { NotificationRepository, NotificationRuleRepository } from './repositories/notification.repository';
import { AuditLogRepository } from './repositories/audit.repository';
import { SettingRepository, RefreshTokenRepository } from './repositories/setting.repository';

import { AuditService } from './services/audit.service';
import { Mailer } from './services/mailer';
import { NotificationService } from './services/notification.service';
import { DriveService } from './services/drive.service';
import { UserService } from './services/user.service';
import { ContentService } from './services/content.service';
import { LinkService } from './services/link.service';
import { StreamingService } from './services/streaming.service';
import { AnalyticsService } from './services/analytics.service';
import { ReportService } from './services/report.service';
import { SettingService } from './services/setting.service';

function build() {
  // Repositories
  const userRepo = new UserRepository();
  const roleRepo = new RoleRepository();
  const contentRepo = new ContentRepository();
  const categoryRepo = new CategoryRepository();
  const tagRepo = new TagRepository();
  const linkRepo = new AccessLinkRepository();
  const deviceRepo = new DeviceRepository();
  const sessionRepo = new SessionRepository();
  const viewLogRepo = new ViewLogRepository();
  const notificationRepo = new NotificationRepository();
  const notificationRuleRepo = new NotificationRuleRepository();
  const auditRepo = new AuditLogRepository();
  const settingRepo = new SettingRepository();
  const refreshRepo = new RefreshTokenRepository();

  // Infrastructure services
  const mailer = new Mailer();
  const auditService = new AuditService(auditRepo);
  const driveService = new DriveService();
  const notificationService = new NotificationService(notificationRepo, notificationRuleRepo, mailer);

  // Domain services
  const userService = new UserService(userRepo, roleRepo, auditService);
  const contentService = new ContentService(contentRepo, tagRepo, driveService, auditService);
  const linkService = new LinkService(linkRepo, contentRepo, auditService);
  const streamingService = new StreamingService(
    linkRepo,
    deviceRepo,
    sessionRepo,
    viewLogRepo,
    driveService,
    notificationService,
    auditService,
  );
  const analyticsService = new AnalyticsService();
  const reportService = new ReportService();
  const settingService = new SettingService(settingRepo, auditService);

  return {
    repositories: {
      userRepo,
      roleRepo,
      contentRepo,
      categoryRepo,
      tagRepo,
      linkRepo,
      deviceRepo,
      sessionRepo,
      viewLogRepo,
      notificationRepo,
      notificationRuleRepo,
      auditRepo,
      settingRepo,
      refreshRepo,
    },
    services: {
      mailer,
      auditService,
      driveService,
      notificationService,
      userService,
      contentService,
      linkService,
      streamingService,
      analyticsService,
      reportService,
      settingService,
    },
  };
}

export const container = build();
export type Container = ReturnType<typeof build>;
