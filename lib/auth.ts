import crypto from 'crypto';
import bcrypt from 'bcryptjs';

function getAccessSecret(): string {
  const value = process.env.JWT_ACCESS_SECRET;
  if (!value) {
    throw new Error('JWT_ACCESS_SECRET must be set');
  }
  return value;
}

function getRefreshSecret(): string {
  const value = process.env.JWT_REFRESH_SECRET;
  if (!value) {
    throw new Error('JWT_REFRESH_SECRET must be set');
  }
  return value;
}

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

type JwtPayload = {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
  exp: number;
};

function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 60 * 60;
  return value * 60 * 60 * 24;
}

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad === 0 ? base64 : `${base64}${'='.repeat(4 - pad)}`;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(payload: Omit<JwtPayload, 'exp'>, secret: string, expiresInSeconds: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: JwtPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
  const content = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(content)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${content}.${signature}`;
}

export function verify(token: string, secret: string): JwtPayload | null {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64Url(payload)) as JwtPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function createAccessToken(userId: string, email: string) {
  return sign({ sub: userId, email, type: 'access' }, getAccessSecret(), parseTtl(ACCESS_TTL));
}

export function createRefreshToken(userId: string, email: string) {
  return sign(
    { sub: userId, email, type: 'refresh' },
    getRefreshSecret(),
    REFRESH_TTL_DAYS * 24 * 60 * 60
  );
}

export function verifyAccessToken(token: string) {
  const payload = verify(token, getAccessSecret());
  if (!payload || payload.type !== 'access') return null;
  return payload;
}

export function verifyRefreshToken(token: string) {
  const payload = verify(token, getRefreshSecret());
  if (!payload || payload.type !== 'refresh') return null;
  return payload;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60
  };
}

export function refreshTokenExpiresAt() {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}
