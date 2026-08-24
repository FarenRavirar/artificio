import { describe, expect, it } from "vitest";
import { normalizeOgDescription } from "./index.js";

describe("normalizeOgDescription", () => {
  it("candidato só-whitespace cai para o próximo candidato", () => {
    expect(normalizeOgDescription(["\n", "segundo candidato"], "fallback")).toBe(
      "segundo candidato",
    );
  });

  it("todos os candidatos em branco caem para o fallback (que também é normalizado)", () => {
    expect(normalizeOgDescription(["   ", "\t", null, undefined], "  fallback  ")).toBe("fallback");
  });

  it("colapsa whitespace interno e faz trim", () => {
    expect(normalizeOgDescription(["  Olá\n   mundo\t!  "], "fallback")).toBe("Olá mundo !");
  });

  it("corta em 200 com reticências no fim", () => {
    const result = normalizeOgDescription(["x".repeat(300)], "fallback");
    expect(result).toHaveLength(200);
    expect(result.endsWith("…")).toBe(true);
  });

  it("max: null devolve o valor limpo sem cortar", () => {
    const value = "x".repeat(300);
    expect(normalizeOgDescription([value], "fallback", { max: null })).toBe(value);
  });

  it("null e undefined são tratados como branco", () => {
    expect(normalizeOgDescription([null, undefined, "", "valor final"], "fallback")).toBe(
      "valor final",
    );
  });
});
