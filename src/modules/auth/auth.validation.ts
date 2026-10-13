import { z } from 'zod';

/**
 * These messages are the first words a new user ever reads from this API, and
 * they appear verbatim under a form field. They are written as instructions to
 * a person - "Enter your email address" - rather than as assertions about a
 * payload, and never mention a field by its code name.
 */
export const signupSchema = z.object({
  email: z
    .string({ error: 'Enter your email address' })
    .email('Enter a valid email address'),
  fullName: z
    .string({ error: 'Enter your name' })
    .trim()
    .min(1, 'Enter your name'),
  password: z
    .string({ error: 'Choose a password' })
    .min(8, 'Your password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z
    .string({ error: 'Enter your email address' })
    .email('Enter a valid email address'),
  password: z.string({ error: 'Enter your password' }).min(1, 'Enter your password'),
});
