import { Request, Response } from 'express';
import { container } from '../container';
import { env } from '../config/env';
import { ok, created } from '../utils/http';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  OAUTH_STATE_COOKIE,
  clearAuthCookies,
  clearOAuthStateCookie,
  setAuthCookies,
  setOAuthStateCookie,
} from '../utils/cookies';
import { auditContext } from '../middleware/context';
import { generateSecureToken, safeEqual } from '../utils/crypto';
import { AppError } from '../utils/errors';

const { authService } = container.services;

function redirectToLogin(res: Response, error: string): void {
  clearOAuthStateCookie(res);
  res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
}

export const authController = {
  /** Returns the Google OAuth consent URL and sets a CSRF state cookie. */
  googleStart(_req: Request, res: Response): void {
    const state = generateSecureToken(16);
    setOAuthStateCookie(res, state);
    const url = authService.getGoogleAuthUrl(state);
    ok(res, { url });
  },

  /** OAuth callback: exchanges the code, sets cookies, redirects to the dashboard. */
  async googleCallback(req: Request, res: Response): Promise<void> {
    if (req.query.error) {
      redirectToLogin(res, 'google_denied');
      return;
    }

    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    const storedState = (req.cookies as Record<string, string> | undefined)?.[OAUTH_STATE_COOKIE];

    if (!code) {
      redirectToLogin(res, 'missing_code');
      return;
    }

    if (!state || !storedState || !safeEqual(state, storedState)) {
      redirectToLogin(res, 'invalid_state');
      return;
    }

    clearOAuthStateCookie(res);

    try {
      const { tokens } = await authService.handleGoogleCallback(code, auditContext(req));
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.redirect(`${env.FRONTEND_URL}/dashboard`);
    } catch (err) {
      const message = err instanceof AppError ? err.code.toLowerCase() : 'oauth_failed';
      redirectToLogin(res, message);
    }
  },

  async signup(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.signup(req.body, auditContext(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    created(res, { user });
  },

  async login(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.loginWithPassword(req.body, auditContext(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    ok(res, { user });
  },

  /** Local development login (disabled in production). */
  async devLogin(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.devLogin(req.body.email, auditContext(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    ok(res, { user });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const token = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!token) throw new AppError('No refresh token provided', 400, 'BAD_REQUEST');
    const tokens = await authService.refresh(token, auditContext(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    ok(res, { refreshed: true });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const token = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    await authService.logout(token, auditContext(req));
    clearAuthCookies(res);
    ok(res, { loggedOut: true });
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getAuthUser(req.user!.id);
    ok(res, { user });
  },

  /** Surface which auth providers are configured (used by the login page). */
  config(_req: Request, res: Response): void {
    ok(res, {
      googleOauthConfigured: env.googleOauthConfigured,
      passwordAuthEnabled: true,
      devLoginEnabled: !env.isProduction,
      accessCookie: ACCESS_COOKIE,
    });
  },
};
