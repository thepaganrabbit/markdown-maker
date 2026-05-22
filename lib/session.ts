import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { Session } from '@/lib/models';

export async function createSession(userId: string, refreshToken: string, expiresAt: Date) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  const session: Session = {
    userId: new ObjectId(userId),
    refreshToken,
    createdAt: new Date(),
    expiresAt
  };
  await sessions.insertOne(session);
}

export async function findSession(refreshToken: string) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  return sessions.findOne({ refreshToken });
}

export async function replaceSession(oldRefreshToken: string, newRefreshToken: string, expiresAt: Date) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  await sessions.findOneAndUpdate(
    { refreshToken: oldRefreshToken },
    { $set: { refreshToken: newRefreshToken, expiresAt } }
  );
}

export async function deleteSession(refreshToken: string) {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');
  await sessions.deleteOne({ refreshToken });
}
