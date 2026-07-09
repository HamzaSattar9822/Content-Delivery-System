import { describe, it, expect } from 'vitest';
import {
  createStreamGrant,
  deviceFingerprint,
  generateSecureToken,
  safeEqual,
  sha256,
  verifyStreamGrant,
} from '../src/utils/crypto';

describe('crypto utilities', () => {
  it('generates unique, URL-safe tokens', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it('hashes deterministically', () => {
    expect(sha256('hello')).toEqual(sha256('hello'));
    expect(sha256('hello')).not.toEqual(sha256('world'));
  });

  it('compares strings in constant time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('signs and verifies a stream grant', () => {
    const grant = createStreamGrant({ linkId: 'link-1', sessionKey: 'sess-1' }, 60);
    const payload = verifyStreamGrant(grant);
    expect(payload).not.toBeNull();
    expect(payload?.linkId).toBe('link-1');
    expect(payload?.sessionKey).toBe('sess-1');
  });

  it('rejects tampered grants', () => {
    const grant = createStreamGrant({ linkId: 'link-1', sessionKey: 'sess-1' }, 60);
    expect(verifyStreamGrant(grant + 'x')).toBeNull();
    expect(verifyStreamGrant('garbage.value')).toBeNull();
  });

  it('rejects expired grants', () => {
    const grant = createStreamGrant({ linkId: 'link-1', sessionKey: 'sess-1' }, -1);
    expect(verifyStreamGrant(grant)).toBeNull();
  });

  it('produces a stable device fingerprint', () => {
    const fp1 = deviceFingerprint('link-1', '1.2.3.4', 'UA');
    const fp2 = deviceFingerprint('link-1', '1.2.3.4', 'UA');
    const fp3 = deviceFingerprint('link-1', '5.6.7.8', 'UA');
    expect(fp1).toEqual(fp2);
    expect(fp1).not.toEqual(fp3);
  });
});
