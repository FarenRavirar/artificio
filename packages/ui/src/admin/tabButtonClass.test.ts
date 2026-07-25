import { describe, expect, it } from "vitest";
import { tabButtonClass } from "./tabButtonClass.js";

describe("tabButtonClass", () => {
  it("distingue estado ativo", () => {
    expect(tabButtonClass(true)).toContain("text-[var(--admin-fg)]");
    expect(tabButtonClass(false)).toContain("text-[var(--admin-fg-low)]");
  });
});
