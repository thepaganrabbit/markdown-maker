import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/models';
import { hashPassword } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin';
import { verifyCsrfForCookieAuth } from '@/lib/csrf';
import { adminUpdateUserSchema, parseJson } from '@/lib/validation';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const { user: adminUser, error: adminError } = await requireAdmin(request);
  if (adminError || !adminUser) return adminError;

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const { data, error } = await parseJson(request, adminUpdateUserSchema);
  if (error) return error;

  const db = await getDb();
  const users = db.collection<User>('users');

  const userId = new ObjectId(params.id);
  const target = await users.findOne({ _id: userId });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent an admin from removing their own admin role mid-session.
  if (target._id!.toString() === adminUser._id!.toString() && data.role === 'user') {
    return NextResponse.json({ error: 'Cannot demote current admin session' }, { status: 400 });
  }

  if (data.email) {
    const duplicate = await users.findOne({ email: data.email, _id: { $ne: userId } });
    if (duplicate) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
  }

  const update: Partial<User> & { passwordHash?: string } = {};
  if (data.email) update.email = data.email;
  if (data.role) update.role = data.role;
  if (data.password) update.passwordHash = await hashPassword(data.password);

  await users.updateOne({ _id: userId }, { $set: update });

  const updated = await users.findOne({ _id: userId }, { projection: { email: 1, role: 1, createdAt: 1 } });

  return NextResponse.json({
    user: {
      id: updated!._id!.toString(),
      email: updated!.email,
      role: updated!.role,
      createdAt: updated!.createdAt
    }
  });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const { user: adminUser, error: adminError } = await requireAdmin(request);
  if (adminError || !adminUser) return adminError;

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  // Prevent accidental lockout by deleting the active admin account.
  if (adminUser._id!.toString() === params.id) {
    return NextResponse.json({ error: 'Cannot delete your own admin user' }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<User>('users');

  const result = await users.deleteOne({ _id: new ObjectId(params.id) });
  if (!result.deletedCount) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
