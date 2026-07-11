import { Response, CookieOptions } from 'express';
import { env } from '../config/env';

export const ACCESS_COOKIE = 'cds_access_token';
export const REFRESH_COOKIE = 'cds_refresh_token';
export const OAUTH_STATE_COOKIE = 'cds_oauth_state';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions(), maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}

export function setOAuthStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE, state, { ...baseOptions(), maxAge: 10 * 60 * 1000 });
}

export function clearOAuthStateCookie(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE, baseOptions());
}
