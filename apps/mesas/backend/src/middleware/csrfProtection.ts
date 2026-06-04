import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const XSRF_COOKIE_NAME = 'xsrf_token';
const XSRF_HEADER_NAME = 'x-xsrf-token';

export const csrfProtection = (allowedOrigins: string[]) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const hasCookieSession = Boolean(req.cookies?.artificio_session);

  if (SAFE_METHODS.has(req.method)) {
    if (hasCookieSession && !req.cookies?.[XSRF_COOKIE_NAME]) {
      res.cookie(XSRF_COOKIE_NAME, crypto.randomUUID(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }
    return next();
  }

  const hasBearerToken = typeof req.headers.authorization === 'string'
    && req.headers.authorization.startsWith('Bearer ');

  if (!hasCookieSession || hasBearerToken) {
    return next();
  }

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    return next();
  }

  const xsrfCookie = req.cookies?.[XSRF_COOKIE_NAME];
  const xsrfHeader = req.headers[XSRF_HEADER_NAME];
  if (
    typeof xsrfCookie === 'string'
    && typeof xsrfHeader === 'string'
    && xsrfCookie === xsrfHeader
  ) {
    return next();
  }

  return res.status(403).json({ error: 'Origem da requisição não permitida.' });
};
