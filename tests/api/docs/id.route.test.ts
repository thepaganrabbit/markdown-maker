import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyCsrfForCookieAuth: vi.fn(() => null),
  getUserFromRequest: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn()
}));

vi.mock('@/lib/csrf', () => ({ verifyCsrfForCookieAuth: mocks.verifyCsrfForCookieAuth }));
vi.mock('@/lib/requestAuth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => ({ collection: vi.fn(() => ({ findOne: mocks.findOne, updateOne: mocks.updateOne, deleteOne: mocks.deleteOne })) })) }));

import { GET, PUT, DELETE } from '@/app/api/docs/[id]/route';

describe('/api/docs/[id] routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET unauthorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost'), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(401);
  });

  it('GET invalid id', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await GET(new Request('http://localhost'), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('GET not found', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost'), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(404);
  });

  it('GET success', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      title: 'Doc',
      content: 'Content',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const res = await GET(new Request('http://localhost'), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(200);
  });

  it('PUT unauthorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await PUT(new Request('http://localhost', { method: 'PUT' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(401);
  });

  it('PUT csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await PUT(new Request('http://localhost', { method: 'PUT' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(403);
  });

  it('PUT invalid id', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await PUT(new Request('http://localhost', { method: 'PUT' }), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('PUT not found', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    const res = await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ title: 'T', content: 'C' }) }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(404);
  });

  it('PUT success', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.updateOne.mockResolvedValueOnce({ matchedCount: 1 });
    const res = await PUT(
      new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated', content: 'Updated content' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439012' } }
    );
    expect(res.status).toBe(200);
  });

  it('DELETE unauthorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(401);
  });

  it('DELETE csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(403);
  });

  it('DELETE invalid id', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('DELETE not found', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(404);
  });

  it('DELETE success', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(200);
  });
});
