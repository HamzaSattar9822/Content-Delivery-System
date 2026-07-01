import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Generate a cryptographically secure, URL-safe random token.
 * Default 32 bytes -> 43-char base64url string.
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Deterministic SHA-256 hash used to store/lookup link tokens (never the raw token). */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** HMAC signature for signed streaming URLs. */
export function hmacSign(value: string): string {
  return crypto.createHmac('sha256', env.LINK_SIGNING_SECRET).update(value).digest('base64url');
}

/** Constant-time comparison to prevent timing attacks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create a short-lived signed streaming grant. Encodes the session and link
 * so the streaming proxy can authorise a request without a DB round trip on
 * every byte-range while still being revocable via expiry.
 */
export interface StreamGrantPayload {
  linkId: string;
  sessionKey: string;
  exp: number; // epoch seconds
}

export function createStreamGrant(payload: Omit<StreamGrantPayload, 'exp'>, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body: StreamGrantPayload = { ...payload, exp };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = hmacSign(encoded);
  return `${encoded}.${sig}`;
}

export function verifyStreamGrant(grant: string): StreamGrantPayload | null {
  const [encoded, sig] = grant.split('.');
  if (!encoded || !sig) return null;
  if (!safeEqual(sig, hmacSign(encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StreamGrantPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Stable device fingerprint derived from request signals + link scope. */
export function deviceFingerprint(linkId: string, ip: string | undefined, userAgent: string | undefined): string {
  return sha256(`${linkId}|${ip ?? 'unknown'}|${userAgent ?? 'unknown'}`).slice(0, 32);
}
