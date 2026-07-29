import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string({ error: 'email is required' }).email('must be a valid email'),
  fullName: z.string({ error: 'fullName is required' }).trim().min(1, 'fullName is required'),
  password: z.string({ error: 'password is required' }).min(8, 'password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string({ error: 'email is required' }).email('must be a valid email'),
  password: z.string({ error: 'password is required' }).min(1, 'password is required'),
});
