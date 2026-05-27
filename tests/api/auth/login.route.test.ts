import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  comparePassword: vi.fn(),
  createSession: vi.fn(),
  ensureCsrfCookie: vi.fn()
}));

vi.mock('@/lib/oauth2', () => ({ jwtEnabled: vi.fn(() => true) }));
vi.mock('@/lib/security', () => ({ rateLimit: vi.fn(() => null) }));
vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({ collection: vi.fn(() => ({ findOne: mocks.findOne })) }))
}));
vi.mock('@/lib/auth', () => ({
  comparePassword: mocks.comparePassword,
  createAccessToken: vi.fn(() => 'access-token'),
  createRefreshToken: vi.fn(() => 'refresh-token'),
  refreshCookieOptions: vi.fn(() => ({ httpOnly: true })),
  refreshTokenExpiresAt: vi.fn(() => new Date('2030-01-01T00:00:00.000Z'))
}));
vi.mock('@/lib/authCookies', () => ({ accessCookieOptions: vi.fn(() => ({ httpOnly: true })) }));
vi.mock('@/lib/csrf', () => ({ ensureCsrfCookie: mocks.ensureCsrfCookie }));
vi.mock('@/lib/session', () => ({ createSession: mocks.createSession }));

import { POST } from '@/app/api/auth/login/route';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unknown user', async () => {
    mocks.findOne.mockResolvedValueOnce(null);

    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ email: 'u@example.com', password: 'password1' })
      })
    );

    expect(res.status).toBe(401);
  });

  it('returns 200 with tokens for valid credentials', async () => {
    mocks.findOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'u@example.com',
      passwordHash: 'hash',
      role: 'user'
    });
    mocks.comparePassword.mockResolvedValueOnce(true);

    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ email: 'u@example.com', password: 'password1' })
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalled();
    expect(mocks.ensureCsrfCookie).toHaveBeenCalled();
  });
});
