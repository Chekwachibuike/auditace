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
}
