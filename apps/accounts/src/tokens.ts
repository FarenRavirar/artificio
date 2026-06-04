import jwt from "jsonwebtoken";
import type { User } from "@artificio/auth";
import type { AccountsEnv } from "./env.js";

export function signAccessToken(user: User, env: AccountsEnv) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar ?? null,
    },
    env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "15m" },
  );
}

export function signRefreshToken(user: User, env: AccountsEnv) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar ?? null,
      typ: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    { algorithm: "HS256", expiresIn: "7d" },
  );
}

export function verifyRefreshToken(token: string, env: AccountsEnv): User | null {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
    });
    if (!payload || typeof payload !== "object") return null;
    const claims = payload as Partial<User> & { sub?: unknown; typ?: unknown };
    if (
      claims.typ !== "refresh" ||
      typeof claims.sub !== "string" ||
      typeof claims.email !== "string" ||
      typeof claims.name !== "string" ||
      (claims.role !== "user" && claims.role !== "admin")
    ) {
      return null;
    }
    return {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      role: claims.role,
      avatar: typeof claims.avatar === "string" ? claims.avatar : null,
    };
  } catch {
    return null;
  }
}
