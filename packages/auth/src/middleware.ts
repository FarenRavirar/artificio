import type { Request, RequestHandler } from "express";
import { verifyToken } from "./jwt";
import type { Session } from "./types";

export interface AuthenticatedRequest extends Request {
  session?: Session;
}

function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const bearerToken = readBearerToken(req.headers.authorization);
  const cookieToken =
    typeof req.cookies?.artificio_session === "string"
      ? req.cookies.artificio_session
      : null;
  const session = verifyToken(bearerToken ?? cookieToken ?? "");

  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  (req as AuthenticatedRequest).session = session;
  next();
};
