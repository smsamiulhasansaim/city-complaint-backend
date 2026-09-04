import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Validates `{ body, params, query }` against a Zod schema. On failure returns
 * the mandatory error envelope with a 422 and a structured `errors` array.
 */
const validate =
  (schema: AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: err.errors.map((e) => ({
            field: e.path.slice(1).join('.') || e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };

export default validate;
