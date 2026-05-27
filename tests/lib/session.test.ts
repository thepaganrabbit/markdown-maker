import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '@/lib/env';

const insertOne = vi.fn();
const findOne = vi.fn();
const findOneAndUpdate = vi.fn();
const deleteOne = vi.fn();
const deleteMany = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn(() => ({ insertOne, findOne, findOneAndUpdate, deleteOne, deleteMany }))
  }))
}));

import { createSession, deleteSession, deleteSessionsByUserId, findSession, replaceSession } from '@/lib/session';

describe('session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores plain refresh token when hashing disabled', async () => {
    env.HASH_REFRESH_TOKENS = false;
    await createSession('507f1f77bcf86cd799439011', 'refresh-token', new Date());

    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'refresh-token' }));
  });

  it('queries hashed refresh token when hashing enabled', async () => {
    env.HASH_REFRESH_TOKENS = true;
    await findSession('refresh-token');

    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: expect.any(String) }));
  });

  it('replaces and deletes session by token', async () => {
    env.HASH_REFRESH_TOKENS = false;
    await replaceSession('old', 'new', new Date());
    expect(findOneAndUpdate).toHaveBeenCalled();

    await deleteSession('new');
    expect(deleteOne).toHaveBeenCalled();
  });

  it('deletes sessions by user id and returns deleted count', async () => {
    deleteMany.mockResolvedValueOnce({ deletedCount: 3 });
    const deleted = await deleteSessionsByUserId('507f1f77bcf86cd799439011');
    expect(deleted).toBe(3);
  });

  it('stores and updates hashed refresh token when hashing enabled', async () => {
    env.HASH_REFRESH_TOKENS = true;
    await createSession('507f1f77bcf86cd799439011', 'refresh-token', new Date());
    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: expect.any(String) }));

    await replaceSession('old', 'new', new Date());
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ refreshTokenHash: expect.any(String) }),
      expect.objectContaining({ $set: expect.objectContaining({ refreshTokenHash: expect.any(String) }) })
    );

    await deleteSession('new');
    expect(deleteOne).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: expect.any(String) }));
  });
});
