
 import { z } from 'zod';
 import { signupSchema, loginSchema } from './auth.validation';

 export type SignupDto = z.infer<typeof signupSchema>;
 export type LoginDto = z.infer<typeof loginSchema>;

