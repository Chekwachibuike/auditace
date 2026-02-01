export interface CreateExpenseDto {
  amount: number;
  description?: string;
  category: string;
  date: string;
}

export interface UpdateExpenseDto {
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
}

export interface ExpenseFilterDto {
  month?: string; // Format: "2024-01"
  category?: string;
  search?: string;
}
