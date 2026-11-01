import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtUserPayload } from '@lifesynch/shared';

const JWT_EXPIRES_IN = '7d';

export const signUserToken = (payload: JwtUserPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'lifesynch-ai'
  });
};

export const verifyUserToken = (token: string): JwtUserPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'lifesynch-ai'
    }) as JwtUserPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Authentication token has expired. Please sign in again.');
    }
    throw new Error('Invalid authentication token.');
  }
};
