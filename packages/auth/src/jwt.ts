import jwt from "jsonwebtoken";
import type { JwtClaims, Session, UserRole } from "./types";

function isRole(value: unknown): value is UserRole {
  return value === "user" || value === "admin";
}

function toSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;
  const claims = value as Partial<JwtClaims>;

  if (
    typeof claims.sub !== "string" ||
    typeof claims.email !== "string" ||
    typeof claims.name !== "string" ||
    typeof claims.exp !== "number" ||
    !isRole(claims.role)
  ) {
    return null;
  }

  return {
    exp: claims.exp,
    user: {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      role: claims.role,
      avatar: typeof claims.avatar === "string" ? claims.avatar : null,
    },
  };
}

export function verifyToken(token: string): Session | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    return toSession(payload);
  } catch {
    return null;
  }
}
