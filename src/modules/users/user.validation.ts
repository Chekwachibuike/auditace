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
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
});
