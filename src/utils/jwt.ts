import jwt, { SignOptions } from 'jsonwebtoken';
import env from '../config/env';

export type AppRole = 'CITIZEN' | 'AGENT' | 'ADMIN';

export interface JwtPayload {
  id: string;
  role: AppRole;
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwtSecret) as JwtPayload;
