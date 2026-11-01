import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { verifyUserToken } from '../utils/jwt';
import { userService } from '../services/db/user.service';
import { User } from '@lifesynch/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing Bearer token.', 401));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new AppError('Authentication failed: Missing Bearer token', 401));
  }

  try {
    const payload = verifyUserToken(token);
    
    // Fetch active user from database
    const user = await userService.getUserById(payload.id);
    if (!user) {
      return next(new AppError('User account associated with this token no longer exists.', 401));
    }

    req.user = user;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid authentication token';
    return next(new AppError(message, 401));
  }
};
