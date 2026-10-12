export interface MonthlySummary {
  month: string;
  totalSpent: number;
  expenseCount: number;
  averageExpense: number;
}

export interface CategoryBreakdown {
  category: string;
  totalSpent: number;
  expenseCount: number;
  percentage: number;
}

export interface BudgetComparison {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  totalSpent: number;
  remaining: number;
  percentageUsed: number;
  status: 'under' | 'on-track' | 'over';
}

export interface DashboardOverview {
  totalSpent: number;
  totalExpenses: number;
  averageMonthlyExpense: number;
  currentMonthSpent: number;
  currentMonthExpenses: number;

  /** Money in. Transfers between the user's own accounts are excluded. */
  totalIncome: number;
  totalIncomeRecords: number;
  currentMonthIncome: number;
  currentMonthIncomeRecords: number;

  /**
   * This month's income minus this month's spending. Negative means more went
   * out than came in, which is the number most people actually want and which
   * no single-direction figure can express.
   */
  currentMonthNet: number;
}
