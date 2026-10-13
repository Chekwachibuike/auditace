import { z } from 'zod';

/**
 * Income mirrors the expense schemas field for field so the two modules stay
 * symmetric. `category` is the SOURCE of the money - Salary, Refund, Gift -
 * rather than what it was spent on; the column keeps the expense name so the
 * repositories and services read the same way.
 */
export const createIncomeSchema = z.object({
  amount: z.number({ error: 'Enter an amount' }).positive('The amount must be more than 0'),
  description: z.string().optional(),
  category: z.string({ error: 'Choose where it came from' }).trim().min(1, 'Choose where it came from'),
  date: z.string({ error: 'Choose a date' }),
});

export const updateIncomeSchema = z.object({
  amount: z.number({ error: 'Enter an amount' }).positive('The amount must be more than 0').optional(),
  description: z.string().optional(),
  category: z.string().trim().min(1, 'Choose where it came from').optional(),
  date: z.string().optional(),
});
