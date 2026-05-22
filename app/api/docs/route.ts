import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { MarkdownDoc } from '@/lib/models';
import { getUserFromRequest } from '@/lib/requestAuth';

export async function GET(request: Request) {
  const user = getUserFromRequest(request);
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
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, content } = await request.json();
  if (!title || !content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');
  const now = new Date();

  const result = await docs.insertOne({
    userId: new ObjectId(user.sub),
    title,
    content,
    createdAt: now,
    updatedAt: now
  });

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
}
