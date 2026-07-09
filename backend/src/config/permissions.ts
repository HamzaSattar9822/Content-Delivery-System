/**
 * Canonical permission catalogue and the default role -> permission mapping.
 * Used by the seed (to populate roles/permissions tables) and by the RBAC
 * middleware (to authorise requests).
 */
export const PERMISSIONS = {
  // Users
  USER_VIEW: 'user:view',
  USER_MANAGE: 'user:manage',
  // Content
  CONTENT_VIEW: 'content:view',
  CONTENT_MANAGE: 'content:manage',
  // Links
  LINK_VIEW: 'link:view',
  LINK_MANAGE: 'link:manage',
  // Drive
  DRIVE_BROWSE: 'drive:browse',
  // Analytics & reports
  ANALYTICS_VIEW: 'analytics:view',
  REPORT_EXPORT: 'report:export',
  // Notifications
  NOTIFICATION_VIEW: 'notification:view',
  NOTIFICATION_MANAGE: 'notification:manage',
  // Audit
  AUDIT_VIEW: 'audit:view',
  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  READ_ONLY: 'READ_ONLY',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  // Full access
  SUPER_ADMIN: ALL_PERMISSIONS,
  // Manage content, generate links, view analytics
  CONTENT_MANAGER: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.CONTENT_MANAGE,
    PERMISSIONS.LINK_VIEW,
    PERMISSIONS.LINK_MANAGE,
    PERMISSIONS.DRIVE_BROWSE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.NOTIFICATION_MANAGE,
  ],
  // View reports only
  READ_ONLY: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.LINK_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  SUPER_ADMIN: 'Full access to all features, users and settings.',
  CONTENT_MANAGER: 'Manage content, generate delivery links and view analytics.',
  READ_ONLY: 'View reports and analytics only.',
};
