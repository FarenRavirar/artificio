import { describe, expect, it } from "vitest";
import { tabButtonClass } from "./tabButtonClass.js";

describe("tabButtonClass", () => {
  it("distingue estado ativo", () => {
    expect(tabButtonClass(true)).toContain("text-[var(--fg)]");
    expect(tabButtonClass(false)).toContain("text-[var(--fg-low)]");
  });
});
