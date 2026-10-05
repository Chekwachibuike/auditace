import { z } from 'zod';

export const linkAccountSchema = z.object({
  code: z.string({ error: 'code is required' }).trim().min(1, 'code is required'),
});

export const syncAccountSchema = z.object({
  /** YYYY-MM-DD. Omit both and the service picks a sensible window. */
  start: z.string().optional(),
  end: z.string().optional(),
  /** Ask the bank directly instead of accepting Mono's cached copy. */
  realTime: z.boolean().optional(),
});

export const acceptTransactionSchema = z.object({
  category: z.string({ error: 'category is required' }).trim().min(1, 'category is required'),
  description: z.string().optional(),
  /**
   * Optional override. Present because a single bank line can bundle things the
   * user wants to split or correct — but it must still be a positive amount,
   * same rule as a hand-entered expense.
   */
  amount: z
    .number({ error: 'amount must be a number' })
    .positive('amount must be greater than 0')
    .optional(),
});
