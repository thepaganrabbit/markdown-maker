import { z } from 'zod';
import { NextResponse } from 'next/server';

export const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase());
export const passwordSchema = z.string().min(8).max(128);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const loginSchema = signupSchema;

export const docMutationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(200_000)
});

export const adminCreateUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['user', 'admin']).default('user')
});

export const adminUpdateUserSchema = z
  .object({
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    role: z.enum(['user', 'admin']).optional()
  })
  .refine((value) => value.email || value.password || value.role, {
    message: 'At least one field must be provided'
  });

export const userSettingsUpdateSchema = z
  .object({
    email: emailSchema.optional(),
    currentPassword: z.string().min(8).max(128),
    newPassword: passwordSchema.optional()
  })
  .refine((value) => value.email || value.newPassword, {
    message: 'Provide at least one change: email or newPassword'
  });

export const docTitleUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

export async function parseJson<T>(request: Request, schema: z.ZodSchema<T>) {
  try {
    const body = await request.json();
    return { data: schema.parse(body), error: null } as const;
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    } as const;
  }
}
