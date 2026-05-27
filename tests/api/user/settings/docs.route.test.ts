import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyCsrfForCookieAuth: vi.fn(() => null),
  getUserFromRequest: vi.fn(),
  findChain: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn()
}));

vi.mock('@/lib/csrf', () => ({ verifyCsrfForCookieAuth: mocks.verifyCsrfForCookieAuth }));
vi.mock('@/lib/requestAuth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn(() => ({ find: mocks.findChain, updateOne: mocks.updateOne, deleteOne: mocks.deleteOne }))
  }))
}));

import { GET as listGet } from '@/app/api/user/settings/docs/route';
import { PATCH as docPatch, DELETE as docDelete } from '@/app/api/user/settings/docs/[id]/route';

describe('settings docs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findChain.mockReturnValue({
      project: () => ({ sort: () => ({ toArray: async () => [] }) })
    });
  });

  it('GET unauthorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await listGet(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('PATCH invalid id', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await docPatch(new Request('http://localhost', { method: 'PATCH' }), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('PATCH csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await docPatch(new Request('http://localhost', { method: 'PATCH' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(403);
  });

  it('GET returns docs when authorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findChain.mockReturnValueOnce({
      project: () => ({
        sort: () => ({
          toArray: async () => [
            {
              _id: { toString: () => '507f1f77bcf86cd799439012' },
              title: 'Doc',
              createdAt: new Date('2020-01-01'),
              updatedAt: new Date('2020-01-02')
            }
          ]
        })
      })
    });
    const res = await listGet(new Request('http://localhost'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.docs).toHaveLength(1);
  });

  it('PATCH unauthorized for invalid auth user', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: 'bad-id' });
    const res = await docPatch(new Request('http://localhost', { method: 'PATCH' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(401);
  });

  it('PATCH returns 404 when document does not match', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    const res = await docPatch(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439012' } }
    );
    expect(res.status).toBe(404);
  });

  it('PATCH updates title successfully', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.updateOne.mockResolvedValueOnce({ matchedCount: 1 });
    const res = await docPatch(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { id: '507f1f77bcf86cd799439012' } }
    );
    expect(res.status).toBe(200);
  });

  it('DELETE invalid id', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await docDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('DELETE csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const res = await docDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(403);
  });

  it('DELETE not found', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    const res = await docDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(404);
  });

  it('DELETE succeeds for owned document', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });
    const res = await docDelete(new Request('http://localhost', { method: 'DELETE' }), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(200);
  });
});
