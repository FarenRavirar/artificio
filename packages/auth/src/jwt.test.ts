import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyToken } from "./jwt.js";

const originalSecret = process.env.JWT_SECRET;

describe("verifyToken", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("returns session for valid HS256 token", () => {
    const token = jwt.sign(
      {
        sub: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
      "test-secret",
      { algorithm: "HS256", expiresIn: "15m" },
    );

    expect(verifyToken(token)).toMatchObject({
      user: {
        id: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
    });
  });

  it("returns null for expired token", () => {
    const token = jwt.sign(
      {
        sub: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
      "test-secret",
      { algorithm: "HS256", expiresIn: "-1s" },
    );

    expect(verifyToken(token)).toBeNull();
  });

  it("returns null for forged token", () => {
    const token = jwt.sign(
      {
        sub: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
      "wrong-secret",
      { algorithm: "HS256", expiresIn: "15m" },
    );

    expect(verifyToken(token)).toBeNull();
  });
});
