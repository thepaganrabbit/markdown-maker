import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { verifyCsrfForCookieAuth } from '@/lib/csrf';
import { deleteSessionsByUserId } from '@/lib/session';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const { error: adminError } = await requireAdmin(request);
  if (adminError) return adminError;

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const deletedSessions = await deleteSessionsByUserId(params.id);
  return NextResponse.json({ ok: true, deletedSessions });
}
