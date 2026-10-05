import { IntegrationRepository } from './integration.repository';
import { describeAccount, monoClient, normaliseTransaction } from './mono.client';
import { AppError, ConflictError, NotFoundError } from '../../shared/AppError';
import type { MonoWebhookEvent, NormalisedTransaction } from './mono.types';

/** How far back a first sync reaches when the caller gives no window. */
const DEFAULT_SYNC_DAYS = 90;

function toDateParam(date: Date): string {
  // Mono's date filters are day-granular.
  return date.toISOString().slice(0, 10);
}

export class IntegrationService {
  constructor(private repository: IntegrationRepository) {}

  /* ---- Linking ----------------------------------------------------------- */

  /**
   * Exchange a Connect code and record the account.
   *
   * Does not sync. Mono needs time to fetch the history and says so with an
   * `account-updated` webhook; pulling immediately tends to return an empty or
   * partial feed, which then looks to the user like "linking didn't work".
   */
  async linkAccount(userId: string, code: string) {
    const monoAccountId = await monoClient.exchangeCode(code);

    const existing = await this.repository.findLinkedAccountByMonoId(monoAccountId);
    if (existing) {
      // Same user re-linking is benign; a different user means the account is
      // already claimed and we must not silently move it.
      if (existing.userId === userId) return existing;
      throw new ConflictError('That bank account is already linked to another user.');
    }

    const account = await monoClient.getAccount(monoAccountId);
    const described = describeAccount(account);

    return this.repository.createLinkedAccount({
      userId,
      monoAccountId,
      institution: described.institution,
      accountName: described.accountName,
      accountNumberMask: described.accountNumberMask,
      currency: described.currency,
    });
  }

  async listAccounts(userId: string) {
    return this.repository.findLinkedAccounts(userId);
  }

  /**
   * Unlink at Mono, then locally.
   *
   * If the remote unlink fails we still remove our record: leaving a row the
   * user has explicitly disconnected would keep showing the account in the UI
   * and keep syncing it, which is worse than an orphaned consent at Mono that
   * they can revoke from their side.
   */
  async unlinkAccount(userId: string, linkedAccountId: string) {
    const account = await this.repository.findLinkedAccount(linkedAccountId, userId);
    if (!account) throw new NotFoundError('Linked account not found');

    try {
      await monoClient.unlink(account.monoAccountId);
    } catch {
      /* Best effort — see the note above. */
    }

    await this.repository.deleteLinkedAccount(account.id);
  }

  /* ---- Sync -------------------------------------------------------------- */

  /**
   * Pull a window of transactions and store the ones we have not seen.
   *
   * Re-running this is safe and expected: the unique constraint on
   * (userId, monoTxnId) absorbs the overlap, so callers can sync a generous
   * window without worrying about duplicates.
   */
  async syncAccount(
    userId: string,
    linkedAccountId: string,
    options: { start?: string; end?: string; realTime?: boolean } = {},
  ) {
    const account = await this.repository.findLinkedAccount(linkedAccountId, userId);
    if (!account) throw new NotFoundError('Linked account not found');

    if (account.status === 'unlinked') {
      throw new AppError('That account has been disconnected. Link it again to resume syncing.');
    }

    const end = options.end ?? toDateParam(new Date());
    const start =
      options.start ??
      toDateParam(
        account.lastSyncedAt
          ? // Overlap the previous sync by a few days. Banks routinely settle a
            // transaction after it first appears, and its details can change;
            // re-reading a short tail costs nothing because of the dedupe.
            new Date(account.lastSyncedAt.getTime() - 3 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() - DEFAULT_SYNC_DAYS * 24 * 60 * 60 * 1000),
      );

    const raw = await monoClient.getTransactions(
      account.monoAccountId,
      { start, end },
      options.realTime ?? false,
    );

    const normalised: NormalisedTransaction[] = [];
    let skipped = 0;
    for (const row of raw) {
      const txn = normaliseTransaction(row);
      if (txn) normalised.push(txn);
      else skipped += 1;
    }

    const imported = await this.repository.insertNewTransactions(
      userId,
      'mono',
      account.id,
      normalised,
    );

    await this.repository.markSynced(account.id);

    // Ask Mono to fill in any missing categories. Asynchronous on their side and
    // strictly optional, so a failure must not fail the sync the user asked for.
    if (normalised.some((txn) => txn.suggestedCategory === null)) {
      void monoClient.requestCategorisation(account.monoAccountId).catch(() => undefined);
    }

    return {
      accountId: account.id,
      window: { start, end },
      received: raw.length,
      imported,
      duplicates: normalised.length - imported,
      skipped,
    };
  }

  async syncAllAccounts(userId: string) {
    const accounts = await this.repository.findLinkedAccounts(userId);
    const results = [];
    for (const account of accounts) {
      if (account.status === 'unlinked') continue;
      try {
        results.push(await this.syncAccount(userId, account.id));
      } catch (error) {
        // One failing bank must not abort the others.
        results.push({
          accountId: account.id,
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }
    return results;
  }

  /* ---- Review ------------------------------------------------------------ */

  async listTransactions(
    userId: string,
    filters: { status?: string; linkedAccountId?: string; type?: string; source?: string },
  ) {
    return this.repository.findTransactions(userId, filters);
  }

  async countPending(userId: string) {
    return this.repository.countPending(userId);
  }

  /**
   * Turn a reviewed transaction into a real expense.
   *
   * Credits are refused outright. A bank feed carries salary, refunds and
   * transfers between the user's own accounts; accepting one as an expense
   * would inflate every total, budget and chart in the app. If someone really
   * wants to record a credit they can add an expense by hand — that is a
   * deliberate act rather than an accident of import.
   */
  async acceptTransaction(
    userId: string,
    importedId: string,
    overrides: { category: string; description?: string; amount?: number },
  ) {
    const txn = await this.repository.findTransaction(importedId, userId);
    if (!txn) throw new NotFoundError('Imported transaction not found');

    if (txn.status === 'accepted') {
      throw new ConflictError('That transaction has already been added to your expenses.');
    }

    if (txn.type !== 'debit') {
      throw new AppError('Only money leaving the account can become an expense.');
    }

    const amount = overrides.amount ?? txn.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Amount must be greater than 0');
    }

    return this.repository.acceptTransaction(importedId, userId, {
      amount,
      description: overrides.description?.trim() || txn.narration,
      category: overrides.category.trim(),
      date: txn.date,
    });
  }

  async ignoreTransaction(userId: string, importedId: string) {
    const txn = await this.repository.findTransaction(importedId, userId);
    if (!txn) throw new NotFoundError('Imported transaction not found');

    if (txn.status === 'accepted') {
      throw new ConflictError(
        'That transaction is already an expense. Delete the expense instead.',
      );
    }

    return this.repository.setTransactionStatus(importedId, 'ignored', null);
  }

  /* ---- Webhooks ---------------------------------------------------------- */

  /**
   * Handle a Mono event.
   *
   * Unknown events are acknowledged rather than rejected: a webhook sender that
   * receives an error will retry, and retrying something we will never
   * understand just generates noise.
   */
  async handleWebhook(event: MonoWebhookEvent) {
    const name = event.event ?? '';
    const accountRef =
      typeof event.data?.account === 'string' ? event.data.account : event.data?.account?.id;
    const monoAccountId = accountRef ?? event.data?.id;

    if (!monoAccountId) return { handled: false, reason: 'no account id on event' };

    const account = await this.repository.findLinkedAccountByMonoId(monoAccountId);
    if (!account) return { handled: false, reason: 'account not linked here' };

    switch (name) {
      case 'mono.events.account_updated':
      case 'account-updated': {
        // Data is ready — this is the signal that a first sync will actually
        // return something.
        const status = event.data?.meta?.data_status;
        if (status && status !== 'AVAILABLE' && status !== 'available') {
          return { handled: true, action: 'noop', dataStatus: status };
        }
        const result = await this.syncAccount(account.userId, account.id);
        return { handled: true, action: 'synced', result };
      }

      case 'mono.events.account_reauthorisation_required':
      case 'mono.events.reauthorisation_required': {
        await this.repository.setStatus(account.id, 'reauth_required');
        return { handled: true, action: 'flagged for reauthorisation' };
      }

      case 'mono.events.account_unlinked': {
        await this.repository.setStatus(account.id, 'unlinked');
        return { handled: true, action: 'marked unlinked' };
      }

      case 'mono.events.transaction_metadata':
      case 'mono.events.transactions_categorised': {
        // Categories have been backfilled; re-read so pending rows show them.
        const raw = await monoClient.getTransactions(account.monoAccountId);
        let updated = 0;
        for (const row of raw) {
          const txn = normaliseTransaction(row);
          if (!txn?.suggestedCategory) continue;
          const result = await this.repository.applyCategory(
            account.userId,
            'mono',
            txn.externalId,
            txn.suggestedCategory,
          );
          updated += result.count;
        }
        return { handled: true, action: 'categories applied', updated };
      }

      default:
        return { handled: false, reason: `unhandled event: ${name}` };
    }
  }
}
