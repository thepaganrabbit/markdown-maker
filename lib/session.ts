import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { Session } from '@/lib/models';
import { env } from '@/lib/env';

function hashRefreshToken(refreshToken: string) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

function sessionQuery(refreshToken: string) {
  if (env.HASH_REFRESH_TOKENS) {
    return { refreshTokenHash: hashRefreshToken(refreshToken) };
  }
  return { refreshToken };
}

export async function createSession(userId: string, refreshToken: string, expiresAt: Date) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  const session: Session = {
    userId: new ObjectId(userId),
    createdAt: new Date(),
    expiresAt,
    ...(env.HASH_REFRESH_TOKENS
      ? { refreshTokenHash: hashRefreshToken(refreshToken) }
      : { refreshToken })
  };
  await sessions.insertOne(session);
}

export async function findSession(refreshToken: string) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  return sessions.findOne(sessionQuery(refreshToken));
}

export async function replaceSession(oldRefreshToken: string, newRefreshToken: string, expiresAt: Date) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');

  const update = env.HASH_REFRESH_TOKENS
    ? {
        $set: { refreshTokenHash: hashRefreshToken(newRefreshToken), expiresAt },
        $unset: { refreshToken: '' as const }
      }
    : { $set: { refreshToken: newRefreshToken, expiresAt } };

  await sessions.findOneAndUpdate(sessionQuery(oldRefreshToken), update);
}

export async function deleteSession(refreshToken: string) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  await sessions.deleteOne(sessionQuery(refreshToken));
}

export async function deleteSessionsByUserId(userId: string) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  const result = await sessions.deleteMany({ userId: new ObjectId(userId) });
  return result.deletedCount;
}
