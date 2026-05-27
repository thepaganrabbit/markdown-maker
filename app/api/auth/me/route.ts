import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/types';
import { getUserFromRequest } from '@/lib/requestAuth';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Missing or invalid access token' }, { status: 401 });
  }

  const db = await getDb();
  const users = db.collection<User>('users');

  const dbUser = ObjectId.isValid(user.sub) ? await users.findOne({ _id: new ObjectId(user.sub) }) : null;
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  return NextResponse.json({ user: { id: dbUser._id!.toString(), email: dbUser.email, role: dbUser.role } });
}
