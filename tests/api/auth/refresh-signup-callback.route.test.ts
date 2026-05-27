import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(() => null),
  cookieGet: vi.fn(),
  verifyRefreshToken: vi.fn(),
  findSession: vi.fn(),
  replaceSession: vi.fn(),
  comparePassword: vi.fn(),
  userFindOne: vi.fn(),
  createSession: vi.fn(),
  usersInsertOne: vi.fn(),
  usersFindOne: vi.fn(),
  parseJson: vi.fn(async () => ({ data: { email: 'u@example.com', password: 'password1' }, error: null })),
  hashPassword: vi.fn(async () => 'hash'),
  jwtEnabled: vi.fn(() => true),
  oauth2Enabled: vi.fn(() => true),
  readOAuth2StateCookie: vi.fn(() => 'state1'),
  exchangeCodeForToken: vi.fn(async () => ({ access_token: 'tok' })),
  fetchOAuth2User: vi.fn(async () => ({ sub: 's', email: 'oauth@example.com' }))
}));

vi.mock('next/headers', () => ({ cookies: () => ({ get: mocks.cookieGet }) }));
vi.mock('@/lib/security', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('@/lib/auth', () => ({
  verifyRefreshToken: mocks.verifyRefreshToken,
  comparePassword: mocks.comparePassword,
  createAccessToken: vi.fn(() => 'a'),
  createRefreshToken: vi.fn(() => 'r2'),
  refreshCookieOptions: vi.fn(() => ({ httpOnly: true })),
  refreshTokenExpiresAt: vi.fn(() => new Date('2030-01-01')),
  hashPassword: mocks.hashPassword
}));
vi.mock('@/lib/authCookies', () => ({ accessCookieOptions: vi.fn(() => ({ httpOnly: true })) }));
vi.mock('@/lib/session', () => ({ findSession: mocks.findSession, replaceSession: mocks.replaceSession, createSession: mocks.createSession }));
vi.mock('@/lib/csrf', () => ({ ensureCsrfCookie: vi.fn() }));
vi.mock('@/lib/oauth2', () => ({
  jwtEnabled: mocks.jwtEnabled,
  oauth2Enabled: mocks.oauth2Enabled,
  readOAuth2StateCookie: mocks.readOAuth2StateCookie,
  exchangeCodeForToken: mocks.exchangeCodeForToken,
  fetchOAuth2User: mocks.fetchOAuth2User
}));
vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return { ...actual, parseJson: mocks.parseJson };
});
vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn((name: string) => {
      if (name === 'users') return { findOne: mocks.userFindOne, insertOne: mocks.usersInsertOne };
      return { findOne: mocks.usersFindOne };
    })
  }))
}));

import { POST as refreshPost } from '@/app/api/auth/refresh/route';
import { POST as signupPost } from '@/app/api/auth/signup/route';
import { GET as callbackGet } from '@/app/api/auth/oauth2/callback/route';
import { POST as loginPost } from '@/app/api/auth/login/route';

describe('auth refresh/signup/oauth2 callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseJson.mockResolvedValue({ data: { email: 'u@example.com', password: 'password1' }, error: null });
  });

  it('refresh returns 401 when missing token', async () => {
    mocks.cookieGet.mockReturnValueOnce(undefined);
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('refresh returns 200 with valid session', async () => {
    mocks.cookieGet.mockReturnValueOnce({ value: 'r1' });
    mocks.verifyRefreshToken.mockReturnValueOnce({ sub: '507f1f77bcf86cd799439011', email: 'u@example.com' });
    mocks.findSession.mockResolvedValueOnce({ expiresAt: new Date(Date.now() + 10000) });
    mocks.userFindOne.mockResolvedValueOnce({ role: 'user' });
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(mocks.replaceSession).toHaveBeenCalled();
  });

  it('refresh returns 401 for invalid refresh jwt', async () => {
    mocks.cookieGet.mockReturnValueOnce({ value: 'r1' });
    mocks.verifyRefreshToken.mockReturnValueOnce(null);
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('refresh returns rate limit response', async () => {
    mocks.rateLimit.mockReturnValueOnce(new Response(null, { status: 429 }));
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(429);
  });

  it('refresh returns 401 for expired or missing session', async () => {
    mocks.cookieGet.mockReturnValueOnce({ value: 'r1' });
    mocks.verifyRefreshToken.mockReturnValueOnce({ sub: '507f1f77bcf86cd799439011', email: 'u@example.com' });
    mocks.findSession.mockResolvedValueOnce(null);
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('refresh returns 401 for expired session', async () => {
    mocks.cookieGet.mockReturnValueOnce({ value: 'r1' });
    mocks.verifyRefreshToken.mockReturnValueOnce({ sub: '507f1f77bcf86cd799439011', email: 'u@example.com' });
    mocks.findSession.mockResolvedValueOnce({ expiresAt: new Date(Date.now() - 1000) });
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('refresh returns 401 for invalid user id in token payload', async () => {
    mocks.cookieGet.mockReturnValueOnce({ value: 'r1' });
    mocks.verifyRefreshToken.mockReturnValueOnce({ sub: 'bad-id', email: 'u@example.com' });
    mocks.findSession.mockResolvedValueOnce({ expiresAt: new Date(Date.now() + 10000) });
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('refresh returns 401 when user does not exist', async () => {
    mocks.cookieGet.mockReturnValueOnce({ value: 'r1' });
    mocks.verifyRefreshToken.mockReturnValueOnce({ sub: '507f1f77bcf86cd799439011', email: 'u@example.com' });
    mocks.findSession.mockResolvedValueOnce({ expiresAt: new Date(Date.now() + 10000) });
    mocks.userFindOne.mockResolvedValueOnce(null);
    const res = await refreshPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('signup returns 409 for existing user', async () => {
    mocks.userFindOne.mockResolvedValueOnce({ _id: 'x' });
    const res = await signupPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(409);
  });

  it('signup creates new user and session', async () => {
    mocks.userFindOne.mockResolvedValueOnce(null);
    mocks.usersInsertOne.mockResolvedValueOnce({ insertedId: { toString: () => '507f1f77bcf86cd799439013' } });
    const res = await signupPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalled();
  });

  it('signup returns 403 when jwt is disabled', async () => {
    mocks.jwtEnabled.mockReturnValueOnce(false);
    const res = await signupPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('signup returns rate limit response', async () => {
    mocks.rateLimit.mockReturnValueOnce(new Response(null, { status: 429 }));
    const res = await signupPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(429);
  });

  it('signup returns parse/validation error response', async () => {
    mocks.parseJson.mockResolvedValueOnce({ data: null, error: new Response(null, { status: 400 }) });
    const res = await signupPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(400);
  });

  it('login route returns 401 for bad password', async () => {
    mocks.userFindOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'u@example.com',
      passwordHash: 'hash',
      role: 'user'
    });
    mocks.comparePassword.mockResolvedValueOnce(false);
    const res = await loginPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('login route returns 403 when jwt is disabled', async () => {
    mocks.jwtEnabled.mockReturnValueOnce(false);
    const res = await loginPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('login route returns rate limit response', async () => {
    mocks.rateLimit.mockReturnValueOnce(new Response(null, { status: 429 }));
    const res = await loginPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(429);
  });

  it('login route returns 401 when user is missing', async () => {
    mocks.userFindOne.mockResolvedValueOnce(null);
    const res = await loginPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('login route returns parse/validation error response', async () => {
    mocks.parseJson.mockResolvedValueOnce({ data: null, error: new Response(null, { status: 400 }) });
    const res = await loginPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(400);
  });

  it('oauth callback returns 400 for bad state', async () => {
    const res = await callbackGet(new Request('http://localhost/api/auth/oauth2/callback?code=1&state=nope'));
    expect(res.status).toBe(400);
  });

  it('oauth callback returns 403 when oauth2 is disabled', async () => {
    mocks.oauth2Enabled.mockReturnValueOnce(false);
    const res = await callbackGet(new Request('http://localhost/api/auth/oauth2/callback?code=1&state=state1'));
    expect(res.status).toBe(403);
  });

  it('oauth callback returns 401 when user profile cannot be resolved', async () => {
    mocks.fetchOAuth2User.mockResolvedValueOnce(null);
    const res = await callbackGet(new Request('http://localhost/api/auth/oauth2/callback?code=1&state=state1'));
    expect(res.status).toBe(401);
  });

  it('oauth callback creates a new user then redirects', async () => {
    mocks.userFindOne.mockResolvedValueOnce(null);
    mocks.usersInsertOne.mockResolvedValueOnce({ insertedId: { toString: () => '507f1f77bcf86cd799439099' } });
    const res = await callbackGet(new Request('http://localhost/api/auth/oauth2/callback?code=1&state=state1'));
    expect(res.status).toBe(307);
    expect(mocks.createSession).toHaveBeenCalled();
  });

  it('oauth callback uses existing user then redirects', async () => {
    mocks.userFindOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'oauth@example.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date()
    });
    const res = await callbackGet(new Request('http://localhost/api/auth/oauth2/callback?code=1&state=state1'));
    expect(res.status).toBe(307);
    expect(mocks.createSession).toHaveBeenCalled();
  });
});
