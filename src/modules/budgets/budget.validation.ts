import { z } from 'zod';

const period = z.enum(['monthly', 'weekly', 'yearly'], {
  error: 'period must be one of: monthly, weekly, yearly',
});

export const createBudgetSchema = z
  .object({
    name: z.string({ error: 'name is required' }).trim().min(1, 'name is required'),
    amount: z.number({ error: 'amount is required and must be a number' }).positive('amount must be greater than 0'),
    category: z.string().optional(),
    period,
    startDate: z.string({ error: 'startDate is required' }),
    endDate: z.string({ error: 'endDate is required' }),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: 'startDate must be before endDate',
    path: ['startDate'],
  });

export const updateBudgetSchema = z.object({
  name: z.string().trim().min(1, 'name cannot be empty').optional(),
  amount: z.number({ error: 'amount must be a number' }).positive('amount must be greater than 0').optional(),
  category: z.string().optional(),
  period: period.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
