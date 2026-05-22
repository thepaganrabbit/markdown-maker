import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/models';
import {
  createAccessToken,
  createRefreshToken,
  hashPassword,
  refreshCookieOptions,
  refreshTokenExpiresAt
} from '@/lib/auth';
import { accessCookieOptions } from '@/lib/authCookies';
import { createSession } from '@/lib/session';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<User>('users');

  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const result = await users.insertOne({
    email: email.toLowerCase(),
    passwordHash,
    createdAt: new Date()
  });

  const userId = result.insertedId.toString();
  const normalizedEmail = email.toLowerCase();
  const accessToken = createAccessToken(userId, normalizedEmail);
  const refreshToken = createRefreshToken(userId, normalizedEmail);
  const refreshExpiresAt = refreshTokenExpiresAt();

  await createSession(userId, refreshToken, refreshExpiresAt);

  const response = NextResponse.json({
    accessToken,
    user: { id: userId, email: normalizedEmail }
  });
  response.cookies.set('refreshToken', refreshToken, refreshCookieOptions());
  response.cookies.set('accessToken', accessToken, accessCookieOptions());
  return response;
}
