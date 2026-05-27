import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyCsrfForCookieAuth: vi.fn(),
  cookieGet: vi.fn(),
  deleteSession: vi.fn(),
  getUserFromRequest: vi.fn(),
  findOne: vi.fn(),
  oauth2Enabled: vi.fn(() => true),
  createOAuth2AuthUrl: vi.fn(() => ({ url: 'https://idp/login', state: 's' })),
  setOAuth2StateCookie: vi.fn()
}));

vi.mock('next/headers', () => ({ cookies: () => ({ get: mocks.cookieGet }) }));
vi.mock('@/lib/csrf', () => ({ verifyCsrfForCookieAuth: mocks.verifyCsrfForCookieAuth }));
vi.mock('@/lib/session', () => ({ deleteSession: mocks.deleteSession }));
vi.mock('@/lib/requestAuth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => ({ collection: vi.fn(() => ({ findOne: mocks.findOne })) })) }));
vi.mock('@/lib/oauth2', () => ({
  oauth2Enabled: mocks.oauth2Enabled,
  createOAuth2AuthUrl: mocks.createOAuth2AuthUrl,
  setOAuth2StateCookie: mocks.setOAuth2StateCookie
}));

import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as meGet } from '@/app/api/auth/me/route';
import { GET as oauthLoginGet } from '@/app/api/auth/oauth2/login/route';

describe('auth logout/me/oauth2 login routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCsrfForCookieAuth.mockReturnValue(null);
  });

  it('logout returns csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await logoutPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('logout deletes session when refresh token exists', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'refresh' });
    const res = await logoutPost(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(mocks.deleteSession).toHaveBeenCalledWith('refresh');
  });

  it('me route returns 401 for missing user', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await meGet(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('me route returns user payload', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce({ _id: { toString: () => '507f1f77bcf86cd799439011' }, email: 'u@e.com', role: 'user' });
    const res = await meGet(new Request('http://localhost'));
    expect(res.status).toBe(200);
  });

  it('me route returns 401 when db user is missing', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce(null);
    const res = await meGet(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('me route returns 401 for invalid user id in token', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: 'bad-id' });
    const res = await meGet(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('oauth2 login redirects when enabled', async () => {
    const res = await oauthLoginGet();
    expect(res.status).toBe(307);
    expect(mocks.setOAuth2StateCookie).toHaveBeenCalled();
  });

  it('oauth2 login returns 403 when disabled', async () => {
    mocks.oauth2Enabled.mockReturnValueOnce(false);
    const res = await oauthLoginGet();
    expect(res.status).toBe(403);
  });
});
