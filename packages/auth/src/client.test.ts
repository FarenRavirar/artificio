import { describe, expect, it } from "vitest";
import { normalizeUser } from "./client.js";

describe("normalizeUser", () => {
  it("accepts the global moderator role", () => {
    expect(
      normalizeUser({
        id: "moderator-1",
        email: "moderator@example.com",
        name: "Moderação",
        role: "moderator",
        roleVersion: 4,
      }),
    ).toEqual({
      id: "moderator-1",
      email: "moderator@example.com",
      name: "Moderação",
      role: "moderator",
      roleVersion: 4,
      avatar: null,
    });
  });

  it("rejects unknown roles", () => {
    expect(
      normalizeUser({
        id: "user-1",
        email: "user@example.com",
        name: "Pessoa",
        role: "owner",
      }),
    ).toBeNull();
  });
});
