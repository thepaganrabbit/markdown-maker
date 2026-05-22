const MIN_SECRET_BYTES = 32;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function ensureStrongSecret(name: string): string {
  const value = requireEnv(name);
  if (process.env.NODE_ENV === 'production' && Buffer.byteLength(value, 'utf8') < MIN_SECRET_BYTES) {
    throw new Error(`${name} must be at least ${MIN_SECRET_BYTES} bytes in production`);
  }
  return value;
}

export const env = {
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_ACCESS_SECRET: ensureStrongSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: ensureStrongSecret('JWT_REFRESH_SECRET'),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? '15m',
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  AUTH_MODE: (process.env.AUTH_MODE ?? 'both') as 'jwt' | 'oauth2' | 'both',
  OAUTH2_AUTHORIZATION_ENDPOINT: process.env.OAUTH2_AUTHORIZATION_ENDPOINT ?? '',
  OAUTH2_TOKEN_ENDPOINT: process.env.OAUTH2_TOKEN_ENDPOINT ?? '',
  OAUTH2_USERINFO_ENDPOINT: process.env.OAUTH2_USERINFO_ENDPOINT ?? '',
  OAUTH2_CLIENT_ID: process.env.OAUTH2_CLIENT_ID ?? '',
  OAUTH2_CLIENT_SECRET: process.env.OAUTH2_CLIENT_SECRET ?? '',
  OAUTH2_CALLBACK_URL: process.env.OAUTH2_CALLBACK_URL ?? '',
  OAUTH2_SCOPE: process.env.OAUTH2_SCOPE ?? 'openid email profile',
  HASH_REFRESH_TOKENS: process.env.HASH_REFRESH_TOKENS === 'true'
};

if (!['jwt', 'oauth2', 'both'].includes(env.AUTH_MODE)) {
  throw new Error('AUTH_MODE must be one of: jwt, oauth2, both');
}
