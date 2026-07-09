import type { betterAuth as BetterAuthFn } from 'better-auth';
import { AuditAction } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { ROLES } from '../config/permissions';
import { logger } from '../utils/logger';
import { importEsm } from './esm';

type BetterAuthModule = { betterAuth: typeof BetterAuthFn };
type PrismaAdapterModule = typeof import('better-auth/adapters/prisma');

/**
 * Build the Better Auth instance. Loaded via dynamic import because Better Auth
 * is ESM-only and this service compiles to CommonJS. The instance type is
 * inferred from this function (see `Auth` below) so no casts are needed.
 *
 * Identity (email/password + optional Google) is persisted to the same Postgres
 * DB through the Prisma adapter and shares the existing `users` table. RBAC
 * (role + permissions) stays in the app's Role/Permission tables and is
 * resolved in the auth middleware.
 */
async function createAuth() {
  const { betterAuth } = await importEsm<BetterAuthModule>('better-auth');
  const { prismaAdapter } = await importEsm<PrismaAdapterModule>('better-auth/adapters/prisma');

  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  return betterAuth({
    appName: 'Content Delivery System',
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    trustedOrigins: env.corsOrigins,

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
    },

    ...(googleConfigured
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          },
        }
      : {}),

    // Map Better Auth's core models onto the existing schema.
    // `image` -> existing `avatarUrl` column on the users table.
    user: {
      modelName: 'user',
      fields: { image: 'avatarUrl' },
      // Required by our Prisma User model; values are assigned in databaseHooks below.
      additionalFields: {
        roleId: {
          type: 'string',
          required: false,
          input: false,
        },
        status: {
          type: 'string',
          required: true,
          defaultValue: 'ACTIVE',
          input: false,
        },
      },
    },
    // Better Auth's default `session` model name collides with the app's
    // content-viewing `Session` model, so point it at AuthSession/auth_sessions.
    session: {
      modelName: 'authSession',
    },

    advanced: {
      // Frontend (Vercel) and backend (Render) are different registrable
      // domains, so the session cookie must be cross-site in production.
      ...(env.isProduction
        ? { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } }
        : {}),
    },

    databaseHooks: {
      user: {
        create: {
          // The users row requires roleId/status, which Better Auth doesn't set.
          // Assign the default role (SUPER_ADMIN for the bootstrap email) here.
          before: async (user) => {
            const email = String(user.email ?? '').toLowerCase();
            const bootstrap = env.BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();
            const roleName =
              bootstrap && email === bootstrap ? ROLES.SUPER_ADMIN : ROLES.READ_ONLY;

            const role = await prisma.role.findUnique({ where: { name: roleName } });
            if (!role) {
              throw new Error(
                'Roles are not seeded. Start the server once (core seed runs on boot) before creating users.',
              );
            }

            return {
              data: {
                ...user,
                name: user.name || email.split('@')[0],
                roleId: role.id,
                status: 'ACTIVE',
              },
            };
          },
        },
      },
      session: {
        create: {
          // Preserve the previous system's login audit trail.
          after: async (session) => {
            const userId = session.userId;
            if (!userId) return;
            try {
              const u = await prisma.user.findUnique({ where: { id: userId } });
              await prisma.auditLog.create({
                data: { userId, actorEmail: u?.email ?? null, action: AuditAction.LOGIN },
              });
            } catch (err) {
              logger.warn({ err }, 'Failed to write LOGIN audit log');
            }
          },
        },
      },
    },
  });
}

/** Inferred type of the initialised Better Auth instance. */
export type Auth = Awaited<ReturnType<typeof createAuth>>;

let authInstance: Auth | null = null;

/** Initialise Better Auth once during startup. */
export async function initAuth(): Promise<Auth> {
  if (!authInstance) {
    authInstance = await createAuth();
  }
  return authInstance;
}

/** Access the initialised Better Auth instance (throws if initAuth() not called). */
export function getAuth(): Auth {
  if (!authInstance) {
    throw new Error('Better Auth is not initialised. Call initAuth() during startup first.');
  }
  return authInstance;
}
