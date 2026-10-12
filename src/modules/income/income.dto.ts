import { z } from 'zod';
import { createIncomeSchema, updateIncomeSchema } from './income.validation';

export type CreateIncomeDto = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeDto = z.infer<typeof updateIncomeSchema>;

export interface IncomeFilterDto {
  month?: string; // "2026-10"
  category?: string;
  search?: string;
}
