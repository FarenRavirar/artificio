import { describe, expect, it } from "vitest";
import type { AccountsEnv } from "./env.js";
import { signRefreshToken, verifyRefreshToken } from "./tokens.js";

const env = {
  JWT_REFRESH_SECRET: "refresh-secret-refresh-secret-refresh",
} as AccountsEnv;

describe("refresh tokens", () => {
  it("accepts moderator and preserves role version", () => {
    const token = signRefreshToken({
      id: "moderator-1",
      email: "moderator@example.com",
      name: "Moderação",
      role: "moderator",
      roleVersion: 7,
      avatar: null,
    }, env);

    expect(verifyRefreshToken(token, env)).toMatchObject({
      id: "moderator-1",
      role: "moderator",
      roleVersion: 7,
    });
  });
});
