import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { verifyCsrfForCookieAuth } from '@/lib/csrf';
import { getDb } from '@/lib/mongodb';
import type { UploadedImage } from '@/lib/models';
import { getUserFromRequest } from '@/lib/requestAuth';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image exceeds 8MB size limit' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const db = await getDb();
  const uploads = db.collection<UploadedImage>('uploaded_images');
  const now = new Date();

  const result = await uploads.insertOne({
    userId: new ObjectId(user.sub),
    filename: file.name,
    contentType: file.type,
    size: file.size,
    bytes,
    createdAt: now
  });

  return NextResponse.json({
    id: result.insertedId.toString(),
    url: `/api/uploads/${result.insertedId.toString()}`
  });
}
