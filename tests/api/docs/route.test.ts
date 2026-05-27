import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyCsrfForCookieAuth: vi.fn(),
  getUserFromRequest: vi.fn(),
  insertOne: vi.fn(),
  find: vi.fn()
}));

vi.mock('@/lib/csrf', () => ({ verifyCsrfForCookieAuth: mocks.verifyCsrfForCookieAuth }));
vi.mock('@/lib/requestAuth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({ collection: vi.fn(() => ({ insertOne: mocks.insertOne, find: mocks.find })) }))
}));

import { GET, POST } from '@/app/api/docs/route';

describe('/api/docs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCsrfForCookieAuth.mockReturnValue(null);
    mocks.find.mockReturnValue({
      project: () => ({ sort: () => ({ toArray: async () => [] }) })
    });
  });

  it('GET unauthorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('GET returns docs', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
  });

  it('POST returns csrf error when validation fails', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await POST(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('POST creates document for authorized user', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.insertOne.mockResolvedValueOnce({ insertedId: { toString: () => '507f1f77bcf86cd799439012' } });
    const res = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ title: 'Title', content: 'Content' }) }));
    expect(res.status).toBe(201);
  });

  it('POST unauthorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ title: 'Title', content: 'Content' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    expect(res.status).toBe(401);
  });

  it('POST returns validation error', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ title: '', content: '' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    expect(res.status).toBe(400);
  });
});
