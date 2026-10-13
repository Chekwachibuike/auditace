import { z } from 'zod';

export const createExpenseSchema = z.object({
  amount: z.number({ error: 'Enter an amount' }).positive('The amount must be more than 0'),
  description: z.string().optional(),
  category: z.string({ error: 'Choose a category' }).trim().min(1, 'Choose a category'),
  date: z.string({ error: 'Choose a date' }),
});

export const updateExpenseSchema = z.object({
  amount: z.number({ error: 'Enter an amount' }).positive('The amount must be more than 0').optional(),
  description: z.string().optional(),
  category: z.string().trim().min(1, 'Choose a category').optional(),
  date: z.string().optional(),
});
