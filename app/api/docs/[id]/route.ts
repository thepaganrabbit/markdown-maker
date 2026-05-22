import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { MarkdownDoc } from '@/lib/models';
import { getUserFromRequest } from '@/lib/requestAuth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');

  const doc = await docs.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(user.sub)
  });

  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    doc: {
      id: doc._id!.toString(),
      title: doc.title,
      content: doc.content,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }
  });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { title, content } = await request.json();
  if (!title || !content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');

  const result = await docs.updateOne(
    {
      _id: new ObjectId(params.id),
      userId: new ObjectId(user.sub)
    },
    {
      $set: {
        title,
        content,
        updatedAt: new Date()
      }
    }
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const db = await getDb();
  const docs = db.collection<MarkdownDoc>('markdown_docs');

  const result = await docs.deleteOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(user.sub)
  });

  if (!result.deletedCount) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
