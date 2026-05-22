import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { verifyCsrfForCookieAuth } from '@/lib/csrf';
import { getDb } from '@/lib/mongodb';
import type { MarkdownDoc } from '@/lib/models';
import { getUserFromRequest } from '@/lib/requestAuth';
import { docTitleUpdateSchema, parseJson } from '@/lib/validation';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const user = await getUserFromRequest(request);
  if (!user || !ObjectId.isValid(user.sub)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
  }

  const { data, error } = await parseJson(request, docTitleUpdateSchema);
  if (error) return error;

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');
  const result = await docs.updateOne(
    { _id: new ObjectId(params.id), userId: new ObjectId(user.sub) },
    { $set: { title: data.title, updatedAt: new Date() } }
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const user = await getUserFromRequest(request);
  if (!user || !ObjectId.isValid(user.sub)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
  }

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');
  const result = await docs.deleteOne({ _id: new ObjectId(params.id), userId: new ObjectId(user.sub) });

  if (!result.deletedCount) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
