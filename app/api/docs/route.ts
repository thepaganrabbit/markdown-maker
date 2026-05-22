import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { MarkdownDoc } from '@/lib/models';
import { verifyCsrfForCookieAuth } from '@/lib/csrf';
import { getUserFromRequest } from '@/lib/requestAuth';
import { docMutationSchema, parseJson } from '@/lib/validation';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');

  const items = await docs
    .find({ userId: new ObjectId(user.sub) })
    .project({ title: 1, updatedAt: 1, createdAt: 1 })
    .sort({ updatedAt: -1 })
    .toArray();

  return NextResponse.json({
    docs: items.map((doc) => ({
      id: doc._id!.toString(),
      title: doc.title,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt
    }))
  });
}

export async function POST(request: Request) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await parseJson(request, docMutationSchema);
  if (error) return error;

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');
  const now = new Date();

  const result = await docs.insertOne({
    userId: new ObjectId(user.sub),
    title: data.title,
    content: data.content,
    createdAt: now,
    updatedAt: now
  });

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
}
