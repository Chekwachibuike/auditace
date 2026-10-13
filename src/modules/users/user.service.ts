import bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { AppError, ConflictError, NotFoundError } from '../../shared/AppError';

export class UserService {
  constructor(private userRepo: UserRepository) {}

  async updateProfile(
    userId: string,
    data: { fullName?: string; email?: string; password?: string },
  ) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();

      // Re-check the password here, not only in the schema: the schema proves
      // one was SENT, this proves it is the right one.
      const matches = await bcrypt.compare(data.password ?? '', user.passwordHash);
      if (!matches) {
        // 400, never 401 - see the note in deleteAccount.
        throw new AppError('That password is not correct.', 400);
      }

      if (email !== user.email.toLowerCase()) {
        const taken = await this.userRepo.findByEmail(email);
        if (taken) throw new ConflictError('That email address is already in use.');
      }
    }

    const updated = await this.userRepo.updateProfile(userId, {
      fullName: data.fullName,
      email: data.email,
    });

    return { id: updated.id, email: updated.email, fullName: updated.fullName };
  }

  /**
   * Replaces the password.
   *
   * Every existing token stays valid afterwards, which is worth being honest
   * about: this app has no session store, so there is nothing to revoke.
   * Someone who already holds a token keeps it until it expires. Proper
   * revocation needs a token version on the user row, checked on every
   * request - a real change, not a line here.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      // 400, never 401: the client signs out on a 401, so a mistyped current
      // password would eject someone mid-form. See deleteAccount.
      throw new AppError('That password is not correct.', 400);
    }

    // Cost read from the environment, which until now set BCRYPT_ROUNDS and
    // was ignored while signup hard-coded 10. bcrypt stores the cost inside
    // the hash, so old and new hashes coexist without migration.
    const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    await this.userRepo.updatePassword(userId, await bcrypt.hash(newPassword, rounds));
  }

  /**
   * Permanently removes the account and everything attached to it.
   *
   * The cascade is enforced by the database, not here: every table with a
   * userId declares `onDelete: Cascade`, which Prisma emits as a real
   * ON DELETE CASCADE foreign key (verified against the live schema for
   * expenses, budgets, linked_accounts, imported_transactions and
   * inbound_emails). Deleting the user row is therefore sufficient AND
   * complete — a table added later inherits the behaviour instead of needing
   * a line in this method, which is exactly the kind of thing that gets
   * forgotten and leaves orphaned financial records behind.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      /**
       * 400, deliberately NOT 401 or 403.
       *
       * The web client treats both of those as "your token is no longer
       * good": it clears the stored session and bounces to the sign-in screen,
       * because this API returns 401 for a missing header and 403 whenever
       * jwt.verify throws (an expired token). That is right for token
       * failures and wrong here — the token is perfectly valid, it is the
       * typed confirmation that is not. Answering 401 would log someone out
       * for one typo, losing the form they were filling in and making it look
       * as though deletion had somehow signed them out. A wrong value in a
       * validated body is a 400.
       */
      throw new AppError('That password is not correct.', 400);
    }

    await this.userRepo.deleteById(userId);
  }
}
