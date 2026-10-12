import { prisma } from '../../database/prisma';
import { MonthlySummary, CategoryBreakdown, BudgetComparison, DashboardOverview } from './dashboard.dto';

export class DashboardRepository {
  async getMonthlySummaries(userId: string, months: number = 12): Promise<MonthlySummary[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const expenses = await prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    const monthlyData = new Map<string, { total: number; count: number }>();

    expenses.forEach((expense: any) => {
      const monthKey = expense.date.toISOString().slice(0, 7); // YYYY-MM
      const current = monthlyData.get(monthKey) || { total: 0, count: 0 };
      monthlyData.set(monthKey, {
        total: current.total + expense.amount,
        count: current.count + 1,
      });
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        totalSpent: data.total,
        expenseCount: data.count,
        averageExpense: data.count > 0 ? data.total / data.count : 0,
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
