import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { MarkdownDoc } from '@/lib/types';
import { getUserFromRequest } from '@/lib/requestAuth';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || !ObjectId.isValid(user.sub)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');

  const items = await docs
    .find({ userId: new ObjectId(user.sub) })
    .project({ title: 1, createdAt: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .toArray();

  return NextResponse.json({
    docs: items.map((doc) => ({
      id: doc._id!.toString(),
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }))
  });
}
