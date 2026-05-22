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
import { ensureCsrfCookie } from '@/lib/csrf';
import { createSession } from '@/lib/session';
import { parseJson, signupSchema } from '@/lib/validation';
import { jwtEnabled } from '@/lib/oauth2';
import { rateLimit } from '@/lib/security';

export async function POST(request: Request) {
  if (!jwtEnabled()) {
    return NextResponse.json({ error: 'JWT auth is disabled' }, { status: 403 });
  }

  const limited = rateLimit(request, { keyPrefix: 'auth:signup', windowMs: 60_000, limit: 10 });
  if (limited) return limited;

  const { data, error } = await parseJson(request, signupSchema);
  if (error) return error;

  const db = await getDb();
  const users = db.collection<User>('users');

  const existing = await users.findOne({ email: data.email });
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(data.password);
  const result = await users.insertOne({
    email: data.email,
    passwordHash,
    role: 'user',
    createdAt: new Date()
  });

  const userId = result.insertedId.toString();
  const accessToken = createAccessToken(userId, data.email);
  const refreshToken = createRefreshToken(userId, data.email);
  const refreshExpiresAt = refreshTokenExpiresAt();

  await createSession(userId, refreshToken, refreshExpiresAt);

  const response = NextResponse.json({
    accessToken,
    user: { id: userId, email: data.email, role: 'user' as const }
  });
  response.cookies.set('refreshToken', refreshToken, refreshCookieOptions());
  response.cookies.set('accessToken', accessToken, accessCookieOptions());
  ensureCsrfCookie(response);
  return response;
}
