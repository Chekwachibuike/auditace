import { z } from 'zod';
import { deleteAccountSchema } from './user.validation';

export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;
