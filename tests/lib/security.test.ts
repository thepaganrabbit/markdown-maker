import { describe, expect, it } from 'vitest';
import { getClientIp, rateLimit } from '@/lib/security';

describe('security', () => {
  it('prefers x-forwarded-for first value', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }
    });
    expect(getClientIp(req)).toBe('1.1.1.1');
  });

  it('returns unknown if no ip headers', () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });

  it('enforces rate limiting and returns retry-after', async () => {
    const req = new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } });
    const keyPrefix = `test-${Date.now()}`;

    expect(rateLimit(req, { keyPrefix, windowMs: 10_000, limit: 1 })).toBeNull();
    const limited = rateLimit(req, { keyPrefix, windowMs: 10_000, limit: 1 });

    expect(limited?.status).toBe(429);
    expect(limited?.headers.get('Retry-After')).toBeTruthy();
  });

  it('allows requests while still under limit', () => {
    const req = new Request('http://localhost', { headers: { 'x-real-ip': '8.8.8.8' } });
    const keyPrefix = `test-allow-${Date.now()}`;
    expect(rateLimit(req, { keyPrefix, windowMs: 10_000, limit: 2 })).toBeNull();
    expect(rateLimit(req, { keyPrefix, windowMs: 10_000, limit: 2 })).toBeNull();
  });
});
