import { z } from 'zod';
import { createExpenseSchema, updateExpenseSchema } from './expense.validation';

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;

export interface ExpenseFilterDto {
  month?: string; // Format: "2024-01"
  category?: string;
  search?: string;
}
