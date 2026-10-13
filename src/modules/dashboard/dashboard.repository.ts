import { prisma } from '../../database/prisma';
import { MonthlySummary, CategoryBreakdown, BudgetComparison, DashboardOverview, AccountBalance, BalanceSummary } from './dashboard.dto';

export class DashboardRepository {
  async getMonthlySummaries(userId: string, months: number = 12): Promise<MonthlySummary[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const [expenses, incomes] = await Promise.all([
      prisma.expense.findMany({ where: { userId, date: { gte: startDate } } }),
      prisma.income.findMany({ where: { userId, date: { gte: startDate } } }),
    ]);

    /**
     * One bucket per month holding BOTH directions.
     *
     * A month is created by whichever side sees it first, so a month with
     * income and no spending still appears - and reads as a surplus rather
     * than vanishing from the series. Dropping it would make the chart skip a
     * month silently, which is worse than showing a zero.
     */
    interface Bucket {
      spent: number;
      expenseCount: number;
      income: number;
      incomeCount: number;
    }
    const monthlyData = new Map<string, Bucket>();
    const bucket = (key: string): Bucket => {
      const existing = monthlyData.get(key);
      if (existing) return existing;
      const fresh: Bucket = { spent: 0, expenseCount: 0, income: 0, incomeCount: 0 };
      monthlyData.set(key, fresh);
      return fresh;
    };

    for (const expense of expenses) {
      const b = bucket(expense.date.toISOString().slice(0, 7)); // YYYY-MM
      b.spent += expense.amount;
      b.expenseCount += 1;
    }

    for (const income of incomes) {
      const b = bucket(income.date.toISOString().slice(0, 7));
      b.income += income.amount;
      b.incomeCount += 1;
    }

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        totalSpent: data.spent,
        expenseCount: data.expenseCount,
        averageExpense: data.expenseCount > 0 ? data.spent / data.expenseCount : 0,
        totalIncome: data.income,
        incomeCount: data.incomeCount,
        net: data.income - data.spent,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  async getCategoryBreakdown(userId: string, month?: string): Promise<CategoryBreakdown[]> {
    const whereClause: any = { userId };

    if (month) {
      const startDate = new Date(month + '-01');
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
    });

    const categoryData = new Map<string, { total: number; count: number }>();

    expenses.forEach((expense: any) => {
      const current = categoryData.get(expense.category) || { total: 0, count: 0 };
      categoryData.set(expense.category, {
        total: current.total + expense.amount,
        count: current.count + 1,
      });
    });

    const totalSpent = Array.from(categoryData.values()).reduce((sum, data) => sum + data.total, 0);

    return Array.from(categoryData.entries())
      .map(([category, data]) => ({
        category,
        totalSpent: data.total,
        expenseCount: data.count,
        percentage: totalSpent > 0 ? (data.total / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }

  async getBudgetComparisons(userId: string): Promise<BudgetComparison[]> {
    const budgets = await prisma.budget.findMany({
      where: { userId },
      include: {
        user: true,
      },
    });

    const comparisons: BudgetComparison[] = [];

    for (const budget of budgets) {
      const expenses = await prisma.expense.findMany({
        where: {
          userId,
          category: budget.category || undefined,
          date: {
            gte: budget.startDate,
            lte: budget.endDate,
          },
        },
      });

      const totalSpent = expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);
      const remaining = budget.amount - totalSpent;
      const percentageUsed = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;

      let status: 'under' | 'on-track' | 'over';
      if (percentageUsed >= 100) {
        status = 'over';
      } else if (percentageUsed >= 80) {
        status = 'on-track';
      } else {
        status = 'under';
      }

      comparisons.push({
        budgetId: budget.id,
        budgetName: budget.name,
        budgetAmount: budget.amount,
        totalSpent,
        remaining,
        percentageUsed,
        status,
      });
    }

    return comparisons.sort((a, b) => b.percentageUsed - a.percentageUsed);
  }

  /**
   * The latest bank-stated balance per account.
   *
   * Ordering is by date then createdAt. `date` is only day-granular - the
   * alerts state a time but a transaction date is a calendar day - so several
   * movements on one day tie, and ingestion order breaks the tie. That is an
   * approximation worth naming: if a backlog of alerts is forwarded out of
   * order, the newest row by ingestion is not necessarily the latest
   * transaction. It is the best available signal, and it is self-correcting -
   * the next real alert restates the true balance.
   */
  async getBalances(userId: string): Promise<BalanceSummary> {
    /**
     * Every alert, not only the ones carrying a balance. The movement totals
     * below must count a transaction whose alert omitted the balance - the
     * money still moved - while the balance itself can only come from a row
     * that stated one.
     */
    const rows = await prisma.importedTransaction.findMany({
      where: { userId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { account: true, balance: true, currency: true, date: true, type: true, amount: true },
    });

    interface Acc {
      balance: number | null;
      currency: string;
      date: Date | null;
      count: number;
      moneyIn: number;
      moneyOut: number;
    }

    const latest = new Map<string, Acc>();
    let unattributed = 0;

    for (const row of rows) {
      if (!row.account) {
        unattributed += 1;
        continue;
      }
      const acc =
        latest.get(row.account) ??
        { balance: null, currency: row.currency, date: null, count: 0, moneyIn: 0, moneyOut: 0 };

      // Movement counts EVERY alert, whatever it was later filed as.
      if (row.type === 'credit') acc.moneyIn += row.amount;
      else acc.moneyOut += row.amount;

      // The balance only advances on a row that actually stated one.
      if (row.balance !== null) {
        acc.balance = row.balance;
        acc.date = row.date;
      }

      acc.currency = row.currency;
      acc.count += 1;
      latest.set(row.account, acc);
    }

    const round = (n: number) => Math.round(n * 100) / 100;

    const accounts: AccountBalance[] = [...latest.entries()]
      .filter(([, data]) => data.balance !== null)
      .map(([account, data]) => ({
        account,
        balance: data.balance as number,
        currency: data.currency,
        asOf: (data.date as Date).toISOString(),
        transactions: data.count,
        moneyIn: round(data.moneyIn),
        moneyOut: round(data.moneyOut),
      }))
      .sort((a, b) => b.balance - a.balance);

    return {
      // Rounded to the kobo. Summing floats produces dust - two balances that
      // are exact to two places add up to 82742.98000000001 - and a currency
      // figure carrying fourteen decimals undermines confidence in a number
      // whose entire job is to be trusted.
      total: Math.round(accounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100,
      currency: accounts[0]?.currency ?? 'NGN',
      // The OLDEST asOf, not the newest: the total is only as current as its
      // stalest component, and reporting the freshest would overstate how
      // much of this figure is actually up to date.
      asOf: accounts.length
        ? accounts.map((a) => a.asOf).sort()[0]
        : null,
      accounts,
      unattributed,
    };
  }

  async getDashboardOverview(userId: string): Promise<DashboardOverview> {
    /**
     * Month bounds in UTC, as a half-open range.
     *
     * Dates are stored at UTC midnight standing for a calendar day, so the
     * window has to be built the same way. The previous version used
     * `new Date(y, m, 1)` and `new Date(y, m + 1, 0)` - LOCAL midnight - with
     * an inclusive upper bound. In any timezone ahead of UTC that upper bound
     * lands BEFORE the last day's UTC midnight, so the final day of every
     * month was quietly missing from the current-month totals. In WAT (UTC+1)
     * that is one day of spending in twelve, absent from the headline figure
     * with nothing to indicate it.
     *
     * `lt` the first instant of next month has no such edge: it needs no
     * knowledge of month length, and leap years and 30-day months fall out of
     * it for free.
     */
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const thisMonth = { gte: monthStart, lt: nextMonthStart };

    const [allExpenses, currentMonthExpenses, allIncome, currentMonthIncome] = await Promise.all([
      prisma.expense.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId, date: thisMonth } }),
      prisma.income.findMany({ where: { userId } }),
      prisma.income.findMany({ where: { userId, date: thisMonth } }),
    ]);

    const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);

    const totalSpent = sum(allExpenses);
    const currentMonthSpent = sum(currentMonthExpenses);
    const totalIncome = sum(allIncome);
    const currentMonthIncomeTotal = sum(currentMonthIncome);

    // Averaged over months that actually have spending, not over calendar
    // months since signup: a dormant month would otherwise drag the average
    // down and make the figure describe nothing in particular.
    const uniqueMonths = new Set(allExpenses.map((e) => e.date.toISOString().slice(0, 7)));
    const averageMonthlyExpense = uniqueMonths.size > 0 ? totalSpent / uniqueMonths.size : 0;

    return {
      totalSpent,
      totalExpenses: allExpenses.length,
      averageMonthlyExpense,
      currentMonthSpent,
      currentMonthExpenses: currentMonthExpenses.length,

      totalIncome,
      totalIncomeRecords: allIncome.length,
      currentMonthIncome: currentMonthIncomeTotal,
      currentMonthIncomeRecords: currentMonthIncome.length,

      currentMonthNet: currentMonthIncomeTotal - currentMonthSpent,
    };
  }
}
