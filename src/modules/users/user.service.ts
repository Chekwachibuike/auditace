import bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { AppError, NotFoundError } from '../../shared/AppError';

export class UserService {
  constructor(private userRepo: UserRepository) {}

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
