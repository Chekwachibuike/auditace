import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from './AppError';

// Validates req.body against a zod schema before the route handler runs,
// so handlers/services can trust their input instead of every one of them
// needing its own ad-hoc checks (which is how raw runtime errors like
// "Cannot read properties of undefined" ended up leaking to API clients).
export const validate =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');
      return next(new AppError(message, 400));
    }
    req.body = result.data;
    next();
  };
