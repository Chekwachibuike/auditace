import { z } from 'zod';

export const createExpenseSchema = z.object({
  amount: z.number({ error: 'amount is required and must be a number' }).positive('amount must be greater than 0'),
  description: z.string().optional(),
  category: z.string({ error: 'category is required' }).trim().min(1, 'category is required'),
  date: z.string({ error: 'date is required' }),
});

export const updateExpenseSchema = z.object({
  amount: z.number({ error: 'amount must be a number' }).positive('amount must be greater than 0').optional(),
  description: z.string().optional(),
  category: z.string().trim().min(1, 'category cannot be empty').optional(),
  date: z.string().optional(),
});
