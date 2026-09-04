import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';
import { verifyToken, JwtPayload, AppRole } from '../utils/jwt';
import prisma from '../config/db';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies the Bearer JWT, re-fetches the user from the DB (so a deleted or
 * banned account is rejected immediately) and attaches `{ id, role }` to req.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('You are not logged in. Please provide a Bearer token.', 401);
    }

    const token = header.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }
    if (user.status === 'BANNED') {
      throw new AppError('Your account has been banned. Contact support.', 403);
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Invalid or expired token.', 401));
  }
};

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 */
export const authorize =
  (...roles: AppRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }
    next();
  };
