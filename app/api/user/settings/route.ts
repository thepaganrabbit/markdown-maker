import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { comparePassword, hashPassword } from '@/lib/auth';
import { verifyCsrfForCookieAuth } from '@/lib/csrf';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/models';
import { getUserFromRequest } from '@/lib/requestAuth';
import { parseJson, userSettingsUpdateSchema } from '@/lib/validation';

export async function GET(request: Request) {
  const authUser = await getUserFromRequest(request);
  if (!authUser || !ObjectId.isValid(authUser.sub)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const users = db.collection<User>('users');
  const user = await users.findOne(
    { _id: new ObjectId(authUser.sub) },
    { projection: { email: 1, role: 1, createdAt: 1 } }
  );

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user._id!.toString(),
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  });
}

export async function PATCH(request: Request) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const authUser = await getUserFromRequest(request);
  if (!authUser || !ObjectId.isValid(authUser.sub)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await parseJson(request, userSettingsUpdateSchema);
  if (error) return error;

  const db = await getDb();
  const users = db.collection<User>('users');
  const userId = new ObjectId(authUser.sub);
  const user = await users.findOne({ _id: userId });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isValid = await comparePassword(data.currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const update: Partial<User> = {};

  if (data.email && data.email !== user.email) {
    const duplicate = await users.findOne({ email: data.email, _id: { $ne: userId } });
    if (duplicate) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    update.email = data.email;
  }

  if (data.newPassword) {
    update.passwordHash = await hashPassword(data.newPassword);
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ ok: true, message: 'No changes applied' });
  }

  await users.updateOne({ _id: userId }, { $set: update });

  const updated = await users.findOne(
    { _id: userId },
    { projection: { email: 1, role: 1, createdAt: 1 } }
  );

  return NextResponse.json({
    ok: true,
    user: {
      id: updated!._id!.toString(),
      email: updated!.email,
      role: updated!.role,
      createdAt: updated!.createdAt
    }
  });
}
