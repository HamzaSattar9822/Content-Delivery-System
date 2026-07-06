import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import { AuditAction } from '@prisma/client';
import { env } from '../config/env';
import { ROLES } from '../config/permissions';
import { RoleRepository } from '../repositories/role.repository';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/setting.repository';
import {
  AccessTokenPayload,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { sha256 } from '../utils/crypto';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors';
import { AuditService, AuditContext } from './audit.service';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  permissions: string[];
  status: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const BCRYPT_ROUNDS = 10;

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
    private readonly refreshRepo: RefreshTokenRepository,
    private readonly audit: AuditService,
  ) {}

  getGoogleAuthUrl(state: string): string {
    if (!env.googleOauthConfigured) {
      throw new BadRequestError('Google OAuth is not configured');
    }
    const client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_OAUTH_REDIRECT_URI,
    );
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      state,
    });
  }

  async handleGoogleCallback(code: string, ctx: AuditContext): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    if (!env.googleOauthConfigured) {
      throw new BadRequestError('Google OAuth is not configured');
    }
    const client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_OAUTH_REDIRECT_URI,
    );
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();
    if (!profile.email) throw new UnauthorizedError('Google account did not return an email');

    const user = await this.findOrCreateUser({
      email: profile.email,
      name: profile.name ?? null,
      googleId: profile.id ?? undefined,
      avatarUrl: profile.picture ?? null,
    });

    return this.completeLogin(user.id, ctx);
  }

  async signup(
    input: { email: string; password: string; name?: string },
    ctx: AuditContext,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // Seeded or OAuth-only users may exist without a password — let them set one via sign-up.
    if (existing) {
      if (existing.passwordHash) {
        throw new ConflictError('An account with this email already exists. Sign in instead.');
      }
      await this.userRepo.update(existing.id, {
        passwordHash,
        name: input.name?.trim() || existing.name,
      });
      return this.completeLogin(existing.id, ctx);
    }

    const roleName = this.defaultRoleForEmail(email);
    const role = await this.roleRepo.findByName(roleName);
    if (!role) throw new BadRequestError('Roles are not seeded. Run the database seed first.');

    const user = await this.userRepo.create({
      email,
      name: input.name?.trim() || email.split('@')[0],
      passwordHash,
      avatarUrl: null,
      role: { connect: { id: role.id } },
    });

    await this.audit.record({
      ...ctx,
      userId: user.id,
      actorEmail: user.email,
      action: AuditAction.USER_CREATE,
      entityType: 'user',
      entityId: user.id,
      metadata: { source: 'signup' },
    });

    return this.completeLogin(user.id, ctx);
  }

  async loginWithPassword(
    input: { email: string; password: string },
    ctx: AuditContext,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedError(
        'No password is set for this account. Use Sign up with this email to create a password.',
      );
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    return this.completeLogin(user.id, ctx);
  }

  /** Local development / test login. Disabled in production. */
  async devLogin(email: string, ctx: AuditContext): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    if (env.isProduction) throw new UnauthorizedError('Development login is disabled');
    const existing = await this.userRepo.findByEmail(email);
    const user = existing ?? (await this.findOrCreateUser({ email, name: email.split('@')[0], avatarUrl: null }));
    return this.completeLogin(user.id, ctx);
  }

  private defaultRoleForEmail(email: string): string {
    return email.toLowerCase() === env.BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase() && env.BOOTSTRAP_SUPER_ADMIN_EMAIL
      ? ROLES.SUPER_ADMIN
      : ROLES.READ_ONLY;
  }

  private async findOrCreateUser(data: {
    email: string;
    name: string | null;
    googleId?: string;
    avatarUrl: string | null;
  }) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      const updates: { googleId?: string; avatarUrl?: string | null; name?: string | null } = {};
      if (data.googleId && !existing.googleId) updates.googleId = data.googleId;
      if (data.avatarUrl && !existing.avatarUrl) updates.avatarUrl = data.avatarUrl;
      if (data.name && !existing.name) updates.name = data.name;
      if (Object.keys(updates).length > 0) {
        await this.userRepo.update(existing.id, updates);
      }
      return existing;
    }

    const roleName = this.defaultRoleForEmail(email);
    const role = await this.roleRepo.findByName(roleName);
    if (!role) throw new BadRequestError('Roles are not seeded. Run the database seed first.');

    return this.userRepo.create({
      email,
      name: data.name,
      googleId: data.googleId,
      avatarUrl: data.avatarUrl,
      role: { connect: { id: role.id } },
    });
  }

  private async completeLogin(userId: string, ctx: AuditContext): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    await this.userRepo.update(userId, { lastLoginAt: new Date() });
    const authUser = await this.getAuthUser(userId);
    if (authUser.status !== 'ACTIVE') throw new UnauthorizedError('Account is suspended');
    const tokens = await this.issueTokens(authUser, ctx);
    await this.audit.record({ ...ctx, userId, actorEmail: authUser.email, action: AuditAction.LOGIN });
    return { user: authUser, tokens };
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UnauthorizedError('User no longer exists');
    const permissions = user.role.permissions.map((rp) => rp.permission.key);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      permissions,
      status: user.status,
    };
  }

  private async issueTokens(user: AuthUser, ctx: AuditContext): Promise<AuthTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };
    const accessToken = signAccessToken(payload);
    const jti = sha256(`${user.id}:${Date.now()}:${Math.random()}`);
    const refreshToken = signRefreshToken({ sub: user.id, jti });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.refreshRepo.create({
      user: { connect: { id: user.id } },
      tokenHash: sha256(refreshToken),
      expiresAt,
      userAgent: ctx.userAgent ?? undefined,
      ipAddress: ctx.ipAddress ?? undefined,
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string, ctx: AuditContext): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
    const stored = await this.refreshRepo.findValidByHash(sha256(refreshToken));
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedError('Refresh token has been revoked');
    }
    await this.refreshRepo.revoke(sha256(refreshToken));
    const authUser = await this.getAuthUser(payload.sub);
    return this.issueTokens(authUser, ctx);
  }

  async logout(refreshToken: string | undefined, ctx: AuditContext): Promise<void> {
    if (refreshToken) await this.refreshRepo.revoke(sha256(refreshToken));
    if (ctx.userId) {
      await this.audit.record({ ...ctx, action: AuditAction.LOGOUT });
    }
  }
}
