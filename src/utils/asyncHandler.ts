import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so rejected promises are forwarded to Express's
 * error-handling middleware instead of crashing the process.
 */
const asyncHandler =
  (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;
