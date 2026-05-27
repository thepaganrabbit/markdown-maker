import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ user: { _id: { toString: () => '507f1f77bcf86cd799439011' } }, error: null })),
  verifyCsrfForCookieAuth: vi.fn(() => null),
  usersFindOne: vi.fn(),
  usersInsertOne: vi.fn(),
  usersDeleteOne: vi.fn(),
  usersUpdateOne: vi.fn(),
  usersFind: vi.fn(),
  usersCount: vi.fn(async () => 0),
  sessionsDistinct: vi.fn(async () => []),
  deleteSessionsByUserId: vi.fn(async () => 2)
}));

vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/csrf', () => ({ verifyCsrfForCookieAuth: mocks.verifyCsrfForCookieAuth }));
vi.mock('@/lib/auth', () => ({ hashPassword: vi.fn(async () => 'hash') }));
vi.mock('@/lib/session', () => ({ deleteSessionsByUserId: mocks.deleteSessionsByUserId }));
vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          findOne: mocks.usersFindOne,
          insertOne: mocks.usersInsertOne,
          deleteOne: mocks.usersDeleteOne,
          updateOne: mocks.usersUpdateOne,
          countDocuments: mocks.usersCount,
          find: mocks.usersFind
        };
      }
      return { distinct: mocks.sessionsDistinct };
    })
  }))
}));

import { GET as usersGet, POST as usersPost } from '@/app/api/admin/users/route';
import { PUT as userPut, DELETE as userDelete } from '@/app/api/admin/users/[id]/route';
import { POST as forceLogoutPost } from '@/app/api/admin/users/[id]/force-logout/route';

describe('admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usersFind.mockReturnValue({
      project: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ toArray: async () => [] }) }) }) })
    });
  });

  it('lists users', async () => {
    const res = await usersGet(new Request('http://localhost/api/admin/users'));
    expect(res.status).toBe(200);
  });

  it('lists users returns admin error', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ user: null, error: new Response(null, { status: 401 }) });
    const res = await usersGet(new Request('http://localhost/api/admin/users'));
    expect(res.status).toBe(401);
  });

  it('lists users with filters/sorting/pagination', async () => {
    mocks.usersFind.mockReturnValueOnce({
      project: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              toArray: async () => [
                {
                  _id: { toString: () => '507f1f77bcf86cd799439012' },
                  email: 'u@example.com',
                  role: 'user',
                  createdAt: new Date()
                }
              ]
            })
          })
        })
      })
    });
    mocks.usersCount.mockResolvedValueOnce(1);
    mocks.sessionsDistinct.mockResolvedValueOnce([{ toString: () => '507f1f77bcf86cd799439012' }]);
    const res = await usersGet(
      new Request(
        'http://localhost/api/admin/users?q=u%40example.com&role=user&sortBy=email&sortDir=asc&page=2&pageSize=20'
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.users[0].isOnline).toBe(true);
  });

  it('creates user conflict', async () => {
    mocks.usersFindOne.mockResolvedValueOnce({ _id: 'x' });
    const res = await usersPost(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'x@y.com', password: 'password1', role: 'user' }) }));
    expect(res.status).toBe(409);
  });

  it('creates user successfully', async () => {
    mocks.usersFindOne.mockResolvedValueOnce(null);
    mocks.usersInsertOne.mockResolvedValueOnce({ insertedId: { toString: () => '507f1f77bcf86cd799439099' } });
    const res = await usersPost(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@y.com', password: 'password1', role: 'admin' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    expect(res.status).toBe(201);
  });

  it('creates user returns admin error', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ user: null, error: new Response(null, { status: 401 }) });
    const res = await usersPost(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'x@y.com', password: 'password1', role: 'user' }) }));
    expect(res.status).toBe(401);
  });

  it('updates user invalid id', async () => {
    const res = await userPut(new Request('http://localhost', { method: 'PUT' }), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('updates user returns validation error for invalid payload', async () => {
    const res = await userPut(
      new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ email: 'not-an-email' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439012' } }
    );
    expect(res.status).toBe(400);
  });

  it('updates user returns csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await userPut(new Request('http://localhost', { method: 'PUT' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(403);
  });

  it('updates user returns admin error', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ user: null, error: new Response(null, { status: 401 }) });
    const res = await userPut(new Request('http://localhost', { method: 'PUT' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(401);
  });

  it('updates user not found', async () => {
    mocks.usersFindOne.mockResolvedValueOnce(null);
    const res = await userPut(
      new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ email: 'n@example.com' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439012' } }
    );
    expect(res.status).toBe(404);
  });

  it('blocks demoting current admin session', async () => {
    mocks.usersFindOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'a@example.com',
      role: 'admin',
      createdAt: new Date()
    });
    const res = await userPut(
      new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ role: 'user' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439011' } }
    );
    expect(res.status).toBe(400);
  });

  it('returns conflict when updating email to duplicate', async () => {
    mocks.usersFindOne
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439012' },
        email: 'a@example.com',
        role: 'user',
        createdAt: new Date()
      })
      .mockResolvedValueOnce({ _id: 'dupe' });
    const res = await userPut(
      new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ email: 'taken@example.com' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439012' } }
    );
    expect(res.status).toBe(409);
  });

  it('updates user successfully', async () => {
    mocks.usersFindOne
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439012' },
        email: 'old@example.com',
        role: 'user',
        createdAt: new Date()
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439012' },
        email: 'new@example.com',
        role: 'admin',
        createdAt: new Date()
      });
    const res = await userPut(
      new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ email: 'new@example.com', role: 'admin', password: 'password1' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439012' } }
    );
    expect(res.status).toBe(200);
    expect(mocks.usersUpdateOne).toHaveBeenCalled();
  });

  it('deletes self admin blocked', async () => {
    const res = await userDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439011' } });
    expect(res.status).toBe(400);
  });

  it('deletes user returns admin error', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ user: null, error: new Response(null, { status: 401 }) });
    const res = await userDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(401);
  });

  it('deletes user invalid id', async () => {
    const res = await userDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('deletes user not found', async () => {
    mocks.usersDeleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    const res = await userDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(404);
  });

  it('deletes user successfully', async () => {
    mocks.usersDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });
    const res = await userDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(200);
  });

  it('force logout returns count', async () => {
    const res = await forceLogoutPost(new Request('http://localhost', { method: 'POST' }), { params: { id: '507f1f77bcf86cd799439099' } });
    expect(res.status).toBe(200);
  });

  it('force logout invalid id', async () => {
    const res = await forceLogoutPost(new Request('http://localhost', { method: 'POST' }), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('force logout returns csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await forceLogoutPost(new Request('http://localhost', { method: 'POST' }), { params: { id: '507f1f77bcf86cd799439099' } });
    expect(res.status).toBe(403);
  });

  it('force logout returns admin error', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ user: null, error: new Response(null, { status: 401 }) });
    const res = await forceLogoutPost(new Request('http://localhost', { method: 'POST' }), { params: { id: '507f1f77bcf86cd799439099' } });
    expect(res.status).toBe(401);
  });
});
