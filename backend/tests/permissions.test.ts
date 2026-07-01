import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_PERMISSIONS, ROLES } from '../src/config/permissions';

describe('RBAC permission model', () => {
  it('grants the super admin every permission', () => {
    expect(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('lets content managers manage content and links but not users', () => {
    const perms = ROLE_PERMISSIONS[ROLES.CONTENT_MANAGER];
    expect(perms).toContain(PERMISSIONS.CONTENT_MANAGE);
    expect(perms).toContain(PERMISSIONS.LINK_MANAGE);
    expect(perms).not.toContain(PERMISSIONS.USER_MANAGE);
    expect(perms).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
  });

  it('restricts read-only role to viewing and reports', () => {
    const perms = ROLE_PERMISSIONS[ROLES.READ_ONLY];
    expect(perms).toContain(PERMISSIONS.ANALYTICS_VIEW);
    expect(perms).toContain(PERMISSIONS.REPORT_EXPORT);
    expect(perms).not.toContain(PERMISSIONS.CONTENT_MANAGE);
    expect(perms).not.toContain(PERMISSIONS.LINK_MANAGE);
  });
});
