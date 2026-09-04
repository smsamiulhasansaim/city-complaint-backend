import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import env from '../config/env';

/** 404 handler — mount after all routes. */
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
};

/** Central error handler — mount last. Always returns { success, message, errors }. */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Something went wrong';
  let errors: unknown[] = [];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors ?? [];
  } else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const target = (err.meta?.target as string[])?.join(', ');
      message = `Duplicate value for field: ${target ?? 'unique constraint'}`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Requested resource not found';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Related record not found (foreign key constraint failed)';
    } else {
      statusCode = 400;
      message = 'Database request error';
    }
    errors = [{ code: err.code }];
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided to the database';
  } else if (
    err instanceof jwt.JsonWebTokenError ||
    err instanceof jwt.TokenExpiredError
  ) {
    statusCode = 401;
    message = 'Invalid or expired token';
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (!env.isProd) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({ success: false, message, errors });
};
