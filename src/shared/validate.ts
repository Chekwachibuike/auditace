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
      /**
       * The message is shown to a PERSON, so it carries no field path.
       *
       * The path was prepended on the assumption that a reader needs telling
       * which field failed - but every message below already names its field
       * in words, so the result was "fullName: fullName is required": the
       * identifier twice, once in a casing no user has ever seen. Where a
       * message needs to name a field it does so in English, where it stands
       * alone it reads as a sentence, and the client shows it verbatim.
       */
      const message = result.error.issues.map((issue) => issue.message).join('. ');
      return next(new AppError(message, 400));
    }
    req.body = result.data;
    next();
  };
