import type { JwtPayload } from '@/lib/types';

function getAccessSecret(): string {
  const value = process.env.JWT_ACCESS_SECRET;
  if (!value) {
    throw new Error('JWT_ACCESS_SECRET must be set');
  }
  return value;
}

function base64UrlToBase64(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  return pad === 0 ? base64 : `${base64}${'='.repeat(4 - pad)}`;
}

function decodeBase64UrlToBytes(value: string) {
  const base64 = base64UrlToBase64(value);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function verifyAccessTokenEdge(token: string): Promise<JwtPayload | null> {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;

  const content = `${header}.${payload}`;
  const keyData = new TextEncoder().encode(getAccessSecret());
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedRaw = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(content));
  const expected = new Uint8Array(expectedRaw);
  const received = decodeBase64UrlToBytes(signature);

  if (!timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const decoded = JSON.parse(new TextDecoder().decode(decodeBase64UrlToBytes(payload))) as JwtPayload;
    if (decoded.type !== 'access') return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
