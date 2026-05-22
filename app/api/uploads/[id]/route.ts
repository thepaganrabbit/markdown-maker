import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { UploadedImage } from '@/lib/models';
import { getUserFromRequest } from '@/lib/requestAuth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const db = await getDb();
  const uploads = db.collection<UploadedImage>('uploaded_images');
  const image = await uploads.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(user.sub)
  });

  if (!image) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Content-Length': String(image.size),
      'Cache-Control': 'private, max-age=3600'
    }
  });
}
