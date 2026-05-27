import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyCsrfForCookieAuth: vi.fn(),
  getUserFromRequest: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn()
}));

vi.mock('@/lib/csrf', () => ({ verifyCsrfForCookieAuth: mocks.verifyCsrfForCookieAuth }));
vi.mock('@/lib/requestAuth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock('@/lib/auth', () => ({ comparePassword: mocks.comparePassword, hashPassword: mocks.hashPassword }));
vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn(() => ({ findOne: mocks.findOne, updateOne: mocks.updateOne }))
  }))
}));

import { GET, PATCH } from '@/app/api/user/settings/route';

describe('PATCH /api/user/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCsrfForCookieAuth.mockReturnValue(null);
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);

    const res = await PATCH(new Request('http://localhost', { method: 'PATCH' }));
    expect(res.status).toBe(401);
  });

  it('returns csrf error before auth checks', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await PATCH(new Request('http://localhost', { method: 'PATCH' }));
    expect(res.status).toBe(403);
  });

  it('returns 404 when user record does not exist', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce(null);
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: 'password1', newPassword: 'password2' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 for wrong current password', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'u@example.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date()
    });
    mocks.comparePassword.mockResolvedValueOnce(false);

    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: 'password1', newPassword: 'password2' })
      })
    );

    expect(res.status).toBe(401);
  });

  it('updates password and email when valid', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'u@example.com',
        passwordHash: 'hash',
        role: 'user',
        createdAt: new Date()
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'new@example.com',
        role: 'user',
        createdAt: new Date()
      });

    mocks.comparePassword.mockResolvedValueOnce(true);
    mocks.hashPassword.mockResolvedValueOnce('new-hash');

    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: 'password1',
          newPassword: 'password2',
          email: 'new@example.com'
        })
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalled();
  });

  it('returns 409 on duplicate email', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'u@example.com',
        passwordHash: 'hash',
        role: 'user',
        createdAt: new Date()
      })
      .mockResolvedValueOnce({ _id: 'dupe' });
    mocks.comparePassword.mockResolvedValueOnce(true);
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: 'password1', email: 'taken@example.com' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    expect(res.status).toBe(409);
  });

  it('returns no-op when no update fields change', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'u@example.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date()
    });
    mocks.comparePassword.mockResolvedValueOnce(true);
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: 'password1', email: 'u@example.com' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain('No changes');
  });

  it('returns validation error for invalid payload', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: '', email: 'bad-email' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/user/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when authenticated user is missing', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(404);
  });

  it('returns user details when authenticated', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'u@example.com',
      role: 'user',
      createdAt: new Date()
    });
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
  });
});
