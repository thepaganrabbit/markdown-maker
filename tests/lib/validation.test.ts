import { describe, expect, it } from 'vitest';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  docMutationSchema,
  docTitleUpdateSchema,
  emailSchema,
  loginSchema,
  parseJson,
  passwordSchema,
  signupSchema,
  userSettingsUpdateSchema
} from '@/lib/validation';

describe('validation', () => {
  it('normalizes email for schema', () => {
    const parsed = emailSchema.parse('  USER@Example.COM ');
    expect(parsed).toBe('user@example.com');
  });

  it('requires at least one admin update field', () => {
    expect(() => adminUpdateUserSchema.parse({})).toThrow();
    expect(adminUpdateUserSchema.parse({ role: 'admin' }).role).toBe('admin');
  });

  it('requires user settings to include actual change', () => {
    expect(() => userSettingsUpdateSchema.parse({ currentPassword: 'password1' })).toThrow();
    expect(
      userSettingsUpdateSchema.parse({ currentPassword: 'password1', newPassword: 'password2' }).newPassword
    ).toBe('password2');
  });

  it('parseJson returns parsed data and no error for valid body', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'password1' })
    });

    const result = await parseJson(req, signupSchema);
    expect(result.error).toBeNull();
    expect(result.data?.email).toBe('a@b.com');
  });

  it('parseJson returns 400 response for invalid body', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ email: 'bad', password: 'short' })
    });

    const result = await parseJson(req, signupSchema);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });

  it('validates document schemas and login alias', () => {
    expect(docMutationSchema.parse({ title: 'T', content: 'Body' }).title).toBe('T');
    expect(docTitleUpdateSchema.parse({ title: 'Updated' }).title).toBe('Updated');
    expect(loginSchema.parse({ email: 'x@y.com', password: 'password1' }).email).toBe('x@y.com');
  });

  it('validates admin create user schema default role and password length', () => {
    expect(adminCreateUserSchema.parse({ email: 'x@y.com', password: 'password1' }).role).toBe('user');
    expect(() => passwordSchema.parse('short')).toThrow();
  });
});
