/**
 * Operational application error. Carries an HTTP status code and an optional
 * structured `errors` array that the central error handler surfaces to clients.
 */
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors: unknown[];

  constructor(message: string, statusCode: number, errors: unknown[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
