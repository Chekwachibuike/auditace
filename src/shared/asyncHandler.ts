import { NextFunction, Request, Response } from 'express';

// Wraps an async route handler so a rejected promise is forwarded to
// Express's error-handling middleware instead of crashing the process or
// being silently swallowed.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
