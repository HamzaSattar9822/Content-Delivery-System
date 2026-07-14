import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { ROLES } from '../config/permissions';
import { importEsm } from '../lib/esm';
import { logger } from '../utils/logger';

type CryptoModule = { hashPassword: (password: string) => Promise<string> };

/**
 * Ensures BOOTSTRAP_SUPER_ADMIN_EMAIL exists as a Better Auth email/password user.
 * Better Auth stores the password on Account (providerId=credential), not on User.
 */
export async function ensureBootstrapAdmin(prisma: PrismaClient): Promise<void> {
  const email = env.BOOTSTRAP_SUPER_ADMIN_EMAIL.trim().toLowerCase();
  const password = env.BOOTSTRAP_SUPER_ADMIN_PASSWORD.trim();
  if (!email || !password) {
    logger.info(
      'Bootstrap admin password skipped (set BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_PASSWORD to create a test login)',
    );
    return;
  }
  if (password.length < 8) {
    logger.warn('BOOTSTRAP_SUPER_ADMIN_PASSWORD must be at least 8 characters; skipping');
    return;
  }

  const role = await prisma.role.findUnique({ where: { name: ROLES.SUPER_ADMIN } });
  if (!role) {
    logger.warn('SUPER_ADMIN role missing; cannot bootstrap admin user');
    return;
  }

  const { hashPassword } = await importEsm<CryptoModule>('better-auth/crypto');
  const hashedPassword = await hashPassword(password);

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0] || 'Admin',
        emailVerified: true,
        status: 'ACTIVE',
        roleId: role.id,
      },
    });
    logger.info({ email }, 'Created bootstrap SUPER_ADMIN user');
  } else if (user.roleId !== role.id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { roleId: role.id, status: 'ACTIVE' },
    });
    logger.info({ email }, 'Promoted bootstrap user to SUPER_ADMIN');
  }

  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
  });

  if (!credential) {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: hashedPassword,
      },
    });
    logger.info({ email }, 'Created Better Auth credential account for bootstrap admin');
    return;
  }

  await prisma.account.update({
    where: { id: credential.id },
    data: { password: hashedPassword },
  });
  logger.info({ email }, 'Updated Better Auth credential password for bootstrap admin');
}
