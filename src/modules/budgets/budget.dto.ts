export interface CreateBudgetDto {
  name: string;
  amount: number;
  category?: string;
  period: 'monthly' | 'weekly' | 'yearly';
  startDate: string;
  endDate: string;
}

export interface UpdateBudgetDto {
  name?: string;
  amount?: number;
  category?: string;
  period?: 'monthly' | 'weekly' | 'yearly';
  startDate?: string;
  endDate?: string;
}

export interface BudgetFilterDto {
  category?: string;
  period?: string;
  active?: boolean; // true for currently active budgets
}
