import { z } from 'zod';
import {
  changePasswordSchema,
  deleteAccountSchema,
  updateProfileSchema,
} from './user.validation';

export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
