import { prisma } from '../../database/prisma';
import type { NormalisedTransaction } from './mono.types';

/**
 * Data access for linked accounts and imported transactions.
 *
 * Uses the shared `prisma` singleton from database/prisma.ts rather than
 * `new PrismaClient()` per repository (which the older modules do) — every extra
 * client opens its own connection pool, and a hosted Postgres will run out of
 * connections long before the app runs out of work.
 */
export class IntegrationRepository {
  /* ---- Linked accounts -------------------------------------------------- */

  async createLinkedAccount(data: {
    userId: string;
    monoAccountId: string;
    institution: string;
    accountName: string | null;
    accountNumberMask: string | null;
    currency: string;
  }) {
    return prisma.linkedAccount.create({ data });
  }

  async findLinkedAccounts(userId: string) {
    return prisma.linkedAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findLinkedAccount(id: string, userId: string) {
    return prisma.linkedAccount.findFirst({ where: { id, userId } });
  }

  async findLinkedAccountByMonoId(monoAccountId: string) {
    return prisma.linkedAccount.findUnique({ where: { monoAccountId } });
  }

  async markSynced(id: string) {
    return prisma.linkedAccount.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });
  }

  async setStatus(id: string, status: string) {
    return prisma.linkedAccount.update({ where: { id }, data: { status } });
  }

  async deleteLinkedAccount(id: string) {
    return prisma.linkedAccount.delete({ where: { id } });
  }

  /* ---- Imported transactions -------------------------------------------- */

  /**
   * Insert everything that is new and leave everything already seen untouched.
   *
   * `skipDuplicates` leans on the @@unique([userId, monoTxnId]) constraint, and
   * that is the whole reason sync is safe to re-run: the second sync of an
   * overlapping window collides instead of duplicating. Deliberately NOT an
   * upsert — once a row has been reviewed, a later sync must not quietly reset
   * its status or overwrite an edited amount.
   *
   * Returns how many rows were actually new so the caller can report it.
   */
  async insertNewTransactions(
    userId: string,
    source: string,
    linkedAccountId: string | null,
    transactions: NormalisedTransaction[],
  ): Promise<number> {
    if (transactions.length === 0) return 0;

    const result = await prisma.importedTransaction.createMany({
      data: transactions.map((txn) => ({
        userId,
        source,
        linkedAccountId,
        externalId: txn.externalId,
        amount: txn.amount,
        currency: txn.currency,
        narration: txn.narration,
        type: txn.type,
        date: txn.date,
        balance: txn.balance,
        suggestedCategory: txn.suggestedCategory,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  /**
   * Backfill categories onto rows that are still awaiting review.
   *
   * Only `pending` rows are touched: once a transaction has been accepted the
   * user's own category choice is the truth, and a late-arriving Mono category
   * must not overrule it.
   */
  async applyCategory(userId: string, source: string, externalId: string, category: string) {
    return prisma.importedTransaction.updateMany({
      where: { userId, source, externalId, status: 'pending' },
      data: { suggestedCategory: category },
    });
  }

  async findTransactions(
    userId: string,
    filters: { status?: string; linkedAccountId?: string; type?: string; source?: string } = {},
  ) {
    return prisma.importedTransaction.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.linkedAccountId ? { linkedAccountId: filters.linkedAccountId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.source ? { source: filters.source } : {}),
      },
      orderBy: { date: 'desc' },
      include: {
        linkedAccount: {
          select: { id: true, institution: true, accountNumberMask: true },
        },
      },
    });
  }

  async findTransaction(id: string, userId: string) {
    return prisma.importedTransaction.findFirst({ where: { id, userId } });
  }

  async setTransactionStatus(id: string, status: string, expenseId: string | null = null) {
    return prisma.importedTransaction.update({
      where: { id },
      data: { status, expenseId },
    });
  }

  /**
   * Create the expense and mark the transaction accepted as ONE transaction.
   *
   * Without this, a failure between the two writes leaves an expense with no
   * link back to its source — so the next sync would see an unaccepted
   * transaction and the user would end up with the same spend counted twice.
   */
  async acceptTransaction(
    importedId: string,
    userId: string,
    expense: { amount: number; description: string | null; category: string; date: Date },
  ) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          userId,
          amount: expense.amount,
          description: expense.description,
          category: expense.category,
          date: expense.date,
          source: 'imported',
        },
      });

      await tx.importedTransaction.update({
        where: { id: importedId },
        data: { status: 'accepted', expenseId: created.id },
      });

      return created;
    });
  }

  async countPending(userId: string) {
    return prisma.importedTransaction.count({ where: { userId, status: 'pending' } });
  }
}
