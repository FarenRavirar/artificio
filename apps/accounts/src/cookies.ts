import type { Response } from "express";
import type { AccountsEnv } from "./env.js";

const accessCookieName = "artificio_session";
const refreshCookieName = "artificio_refresh";

function cookieOptions(env: AccountsEnv) {
  return {
    domain: env.COOKIE_DOMAIN,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: true,
  };
}

export function setSessionCookies(
  res: Response,
  env: AccountsEnv,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(accessCookieName, accessToken, {
    ...cookieOptions(env),
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(refreshCookieName, refreshToken, {
    ...cookieOptions(env),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(res: Response, env: AccountsEnv) {
  res.clearCookie(accessCookieName, cookieOptions(env));
  res.clearCookie(refreshCookieName, cookieOptions(env));
}

export { accessCookieName, refreshCookieName };
