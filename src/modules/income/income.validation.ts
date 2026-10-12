import { z } from 'zod';

/**
 * Income mirrors the expense schemas field for field so the two modules stay
 * symmetric. `category` is the SOURCE of the money - Salary, Refund, Gift -
 * rather than what it was spent on; the column keeps the expense name so the
 * repositories and services read the same way.
 */
export const createIncomeSchema = z.object({
  amount: z
    .number({ error: 'amount is required and must be a number' })
    .positive('amount must be greater than 0'),
  description: z.string().optional(),
  category: z.string({ error: 'category is required' }).trim().min(1, 'category is required'),
  date: z.string({ error: 'date is required' }),
});

export const updateIncomeSchema = z.object({
  amount: z.number({ error: 'amount must be a number' }).positive('amount must be greater than 0').optional(),
  description: z.string().optional(),
  category: z.string().trim().min(1, 'category cannot be empty').optional(),
  date: z.string().optional(),
});
