import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/models';
import {
  comparePassword,
  createAccessToken,
  createRefreshToken,
  refreshCookieOptions,
  refreshTokenExpiresAt
} from '@/lib/auth';
import { accessCookieOptions } from '@/lib/authCookies';
import { createSession } from '@/lib/session';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<User>('users');

  const user = await users.findOne({ email: email.toLowerCase() });
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const userId = user._id!.toString();
  const accessToken = createAccessToken(userId, user.email);
  const refreshToken = createRefreshToken(userId, user.email);
  const refreshExpiresAt = refreshTokenExpiresAt();

  await createSession(userId, refreshToken, refreshExpiresAt);

  const response = NextResponse.json({
    accessToken,
    user: { id: userId, email: user.email }
  });
  response.cookies.set('refreshToken', refreshToken, refreshCookieOptions());
  response.cookies.set('accessToken', accessToken, accessCookieOptions());
  return response;
}
