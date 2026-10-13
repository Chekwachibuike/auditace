import { z } from 'zod';

/**
 * Deleting an account re-checks the password even though the request already
 * carries a valid token.
 *
 * A JWT here lasts seven days and lives in localStorage, so a borrowed laptop
 * or a lifted token is enough to act as someone. For reversible actions that
 * is an acceptable trade; for one that destroys every expense, budget and
 * imported transaction with no recovery, it is not. Re-entering the password
 * proves a person is present rather than merely a session.
 */
/**
 * Updating the profile.
 *
 * Both fields are optional so a caller can change one without restating the
 * other, but `password` is required WHENEVER the email changes. The email is
 * the login identifier: anyone who reaches an unlocked session could
 * otherwise point the account at an address they control and take it over
 * permanently. Changing a display name carries no such risk and asks for
 * nothing.
 */
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Enter your name').max(120, 'That name is too long').optional(),
    email: z.string().email('Enter a valid email address').optional(),
    password: z.string().optional(),
  })
  .refine((data) => data.fullName !== undefined || data.email !== undefined, {
    message: 'Nothing to update',
  })
  .refine((data) => data.email === undefined || Boolean(data.password), {
    message: 'Enter your password to change your email address',
    path: ['password'],
  });

/**
 * Changing the password.
 *
 * The current one is required even though the request is authenticated: a
 * token proves a session, not a person, and the whole point of a password
 * change is to lock out whoever should not have one. A new password set from
 * a borrowed session would do the opposite.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Your new password must be at least 8 characters'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Your new password must be different from your current one',
    path: ['newPassword'],
  });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
});
