import { Request, Response, NextFunction } from 'express';

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseCookies(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.cookie;
  const cookies: Record<string, string> = {};

  if (header) {
    for (const part of header.split(';')) {
      const separator = part.indexOf('=');
      if (separator <= 0) {
        continue;
      }

      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (name) {
        cookies[name] = decodeCookieValue(value);
      }
    }
  }

  req.cookies = cookies;
  next();
}
