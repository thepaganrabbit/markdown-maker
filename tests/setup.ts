import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/testdb';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'b'.repeat(32);
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

afterEach(() => {
  cleanup();
});
