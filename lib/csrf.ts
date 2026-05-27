import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

export function ensureCsrfCookie(response: NextResponse) {
  const existing = cookies().get(CSRF_COOKIE_NAME)?.value;
  if (existing) return;
  response.cookies.set(CSRF_COOKIE_NAME, crypto.randomBytes(32).toString('hex'), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
}

export function verifyCsrfForCookieAuth(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ');
  // Non-cookie bearer auth is not vulnerable to browser CSRF.
  if (hasBearer) return null;

  const cookieToken = cookies().get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  return null;
}

export function getCsrfHeaderName() {
  return CSRF_HEADER_NAME;
}
