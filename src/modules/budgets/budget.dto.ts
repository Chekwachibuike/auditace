import { z } from 'zod';
import { createBudgetSchema, updateBudgetSchema } from './budget.validation';

export type CreateBudgetDto = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetDto = z.infer<typeof updateBudgetSchema>;

export interface BudgetFilterDto {
  category?: string;
  period?: string;
  active?: boolean; // true for currently active budgets
}
