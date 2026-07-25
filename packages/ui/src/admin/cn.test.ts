import { describe, expect, it } from "vitest";
import { cn } from "./cn.js";

describe("cn", () => {
  it("junta apenas classes presentes", () => expect(cn("a", false, null, "b")).toBe("a b"));
});
