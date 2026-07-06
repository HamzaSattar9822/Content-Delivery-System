import { PrismaClient } from '@prisma/client';
import {
  ALL_PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  ROLES,
  RoleName,
} from '../config/permissions';
import { logger } from '../utils/logger';

/** Idempotent permissions + roles bootstrap so signup works without a manual seed step. */
export async function ensureCoreSeed(prisma: PrismaClient): Promise<void> {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  for (const roleName of Object.values(ROLES) as RoleName[]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: ROLE_DESCRIPTIONS[roleName], isSystem: true },
      create: { name: roleName, description: ROLE_DESCRIPTIONS[roleName], isSystem: true },
    });

    const permissionKeys = ROLE_PERMISSIONS[roleName];
    const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  logger.info('Core RBAC seed verified (permissions and roles)');
}
