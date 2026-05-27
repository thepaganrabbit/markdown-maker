import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  comparePassword,
  createAccessToken,
  createRefreshToken,
  hashPassword,
  refreshCookieOptions,
  refreshTokenExpiresAt,
  verify,
  verifyAccessToken,
  verifyRefreshToken
} from '@/lib/auth';
import { env } from '@/lib/env';

describe('auth', () => {
  it('creates and verifies access token', () => {
    const token = createAccessToken('user-1', 'u@example.com');
    const payload = verifyAccessToken(token);

    expect(payload?.sub).toBe('user-1');
    expect(payload?.type).toBe('access');
  });

  it('rejects token when secret is wrong', () => {
    const token = createAccessToken('user-1', 'u@example.com');
    expect(verify(token, 'not-the-right-secret')).toBeNull();
  });

  it('enforces token type for refresh tokens', () => {
    const access = createAccessToken('user-1', 'u@example.com');
    expect(verifyRefreshToken(access)).toBeNull();
    expect(verifyAccessToken(access)?.type).toBe('access');

    const refresh = createRefreshToken('user-1', 'u@example.com');
    expect(verifyRefreshToken(refresh)?.type).toBe('refresh');
    expect(verifyAccessToken(refresh)).toBeNull();
  });

  it('uses configured refresh cookie max age', () => {
    const opts = refreshCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.maxAge).toBe(env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60);
  });

  it('rejects malformed tokens', () => {
    expect(verify('bad-token', env.JWT_ACCESS_SECRET)).toBeNull();
    expect(verify('a.b.c.d', env.JWT_ACCESS_SECRET)).toBeNull();
  });

  it('hashes and compares passwords', async () => {
    const hash = await hashPassword('password1');
    await expect(comparePassword('password1', hash)).resolves.toBe(true);
    await expect(comparePassword('password2', hash)).resolves.toBe(false);
  });

  it('returns a future refresh token expiration date', () => {
    const expiresAt = refreshTokenExpiresAt().getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('handles ttl units for hours and days', async () => {
    vi.resetModules();
    process.env.ACCESS_TOKEN_TTL = '1h';
    const hourAuth = await import('@/lib/auth');
    const token1 = hourAuth.createAccessToken('user-1', 'u@example.com');
    const payload1 = hourAuth.verifyAccessToken(token1);
    const inSeconds1 = (payload1?.exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(inSeconds1).toBeGreaterThan(3500);

    vi.resetModules();
    process.env.ACCESS_TOKEN_TTL = '1d';
    const dayAuth = await import('@/lib/auth');
    const token2 = dayAuth.createAccessToken('user-1', 'u@example.com');
    const payload2 = dayAuth.verifyAccessToken(token2);
    const inSeconds2 = (payload2?.exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(inSeconds2).toBeGreaterThan(85_000);
    process.env.ACCESS_TOKEN_TTL = '15m';
  });

  it('returns null when payload cannot be parsed as json', () => {
    const toBase64Url = (value: string) =>
      Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = toBase64Url('{');
    const content = `${header}.${payload}`;
    const signature = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(content)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    expect(verify(`${content}.${signature}`, env.JWT_ACCESS_SECRET)).toBeNull();
  });

  it('handles seconds ttl, invalid ttl fallback, and expired token', async () => {
    vi.resetModules();
    process.env.ACCESS_TOKEN_TTL = '1s';
    const secAuth = await import('@/lib/auth');
    const shortToken = secAuth.createAccessToken('user-1', 'u@example.com');
    const shortPayload = secAuth.verifyAccessToken(shortToken);
    const secDelta = (shortPayload?.exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(secDelta).toBeLessThanOrEqual(2);

    vi.resetModules();
    process.env.ACCESS_TOKEN_TTL = 'nope';
    const fallbackAuth = await import('@/lib/auth');
    const fallbackToken = fallbackAuth.createAccessToken('user-1', 'u@example.com');
    const fallbackPayload = fallbackAuth.verifyAccessToken(fallbackToken);
    const fallbackDelta = (fallbackPayload?.exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(fallbackDelta).toBeGreaterThan(850);

    const toBase64Url = (value: string) =>
      Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = toBase64Url(JSON.stringify({ sub: 'u', email: 'u@example.com', type: 'access', exp: 1 }));
    const content = `${header}.${payload}`;
    const signature = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(content)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(verify(`${content}.${signature}`, env.JWT_ACCESS_SECRET)).toBeNull();
    process.env.ACCESS_TOKEN_TTL = '15m';
  });
});
