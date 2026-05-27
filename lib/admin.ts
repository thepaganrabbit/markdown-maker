import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/types';
import { getUserFromRequest } from '@/lib/requestAuth';

export async function getCurrentUserRecord(request: Request) {
  const authUser = await getUserFromRequest(request);
  if (!authUser || !ObjectId.isValid(authUser.sub)) return null;

  const db = await getDb();
  const users = db.collection<User>('users');
  return users.findOne({ _id: new ObjectId(authUser.sub) });
}

export async function requireAdmin(request: Request) {
  const user = await getCurrentUserRecord(request);
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  if (user.role !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  return { user, error: null } as const;
}
