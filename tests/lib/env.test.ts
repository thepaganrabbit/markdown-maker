import { afterAll, describe, expect, it, vi } from 'vitest';

const baseEnv = { ...process.env };

async function loadEnvModule() {
  vi.resetModules();
  return import('@/lib/env');
}

describe('env', () => {
  it('loads defaults with valid required env vars', async () => {
    process.env = {
      ...baseEnv,
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/testdb',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      AUTH_MODE: 'both'
    };

    const { env } = await loadEnvModule();
    expect(env.ACCESS_TOKEN_TTL).toBe('15m');
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  it('throws if a required env var is missing', async () => {
    process.env = {
      ...baseEnv,
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32)
    };
    delete process.env.MONGODB_URI;

    await expect(loadEnvModule()).rejects.toThrow('MONGODB_URI must be set');
  });

  it('throws in production when JWT secret is too short', async () => {
    process.env = {
      ...baseEnv,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/testdb',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'b'.repeat(32)
    };

    await expect(loadEnvModule()).rejects.toThrow('JWT_ACCESS_SECRET must be at least 32 bytes in production');
  });

  it('throws for invalid auth mode', async () => {
    process.env = {
      ...baseEnv,
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/testdb',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      AUTH_MODE: 'invalid-mode'
    };

    await expect(loadEnvModule()).rejects.toThrow('AUTH_MODE must be one of: jwt, oauth2, both');
  });

  afterAll(() => {
    process.env = baseEnv;
  });
});
