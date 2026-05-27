import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyCsrfForCookieAuth: vi.fn(() => null),
  getUserFromRequest: vi.fn(),
  insertOne: vi.fn(),
  findOne: vi.fn()
}));

vi.mock('@/lib/csrf', () => ({ verifyCsrfForCookieAuth: mocks.verifyCsrfForCookieAuth }));
vi.mock('@/lib/requestAuth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => ({ collection: vi.fn(() => ({ insertOne: mocks.insertOne, findOne: mocks.findOne })) })) }));

import { POST as uploadPost } from '@/app/api/uploads/route';
import { GET as uploadGet } from '@/app/api/uploads/[id]/route';

describe('upload routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCsrfForCookieAuth.mockReturnValue(null);
  });

  it('POST returns csrf error', async () => {
    mocks.verifyCsrfForCookieAuth.mockReturnValueOnce(new Response(null, { status: 403 }));
    const fd = new FormData();
    fd.append('file', new File(['a'], 'a.png', { type: 'image/png' }));
    const res = await uploadPost(new Request('http://localhost', { method: 'POST', body: fd }));
    expect(res.status).toBe(403);
  });

  it('POST unauthorized', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.append('file', new File(['a'], 'a.txt', { type: 'text/plain' }));
    const res = await uploadPost(new Request('http://localhost', { method: 'POST', body: fd }));
    expect(res.status).toBe(401);
  });

  it('POST rejects missing file', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const fd = new FormData();
    const res = await uploadPost(new Request('http://localhost', { method: 'POST', body: fd }));
    expect(res.status).toBe(400);
  });

  it('POST rejects non-image file type', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const fd = new FormData();
    fd.append('file', new File(['x'], 'x.txt', { type: 'text/plain' }));
    const res = await uploadPost(new Request('http://localhost', { method: 'POST', body: fd }));
    expect(res.status).toBe(400);
  });

  it('POST rejects image larger than 8MB', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const fd = new FormData();
    fd.append('file', new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }));
    const res = await uploadPost(new Request('http://localhost', { method: 'POST', body: fd }));
    expect(res.status).toBe(400);
  });

  it('POST stores image and returns id/url', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.insertOne.mockResolvedValueOnce({ insertedId: { toString: () => '507f1f77bcf86cd799439099' } });
    const fd = new FormData();
    fd.append('file', new File(['img'], 'a.png', { type: 'image/png' }));
    const res = await uploadPost(new Request('http://localhost', { method: 'POST', body: fd }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('507f1f77bcf86cd799439099');
    expect(json.url).toContain('/api/uploads/');
  });

  it('GET invalid id', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    const res = await uploadGet(new Request('http://localhost'), { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('GET unauthorized when no user', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const res = await uploadGet(new Request('http://localhost'), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(401);
  });

  it('GET returns 404 when image does not exist', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce(null);
    const res = await uploadGet(new Request('http://localhost'), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(404);
  });

  it('GET returns image bytes', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ sub: '507f1f77bcf86cd799439011' });
    mocks.findOne.mockResolvedValueOnce({ bytes: Buffer.from('abc'), contentType: 'image/png', size: 3 });
    const res = await uploadGet(new Request('http://localhost'), { params: { id: '507f1f77bcf86cd799439012' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });
});
