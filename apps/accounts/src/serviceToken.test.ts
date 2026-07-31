import { describe, expect, it } from "vitest";
import { isValidServiceToken, timingSafeEqualStrings } from "./serviceToken.js";

const SECRET = "service-secret-service-secret-01";

describe("timingSafeEqualStrings", () => {
  it("aceita strings iguais", () => {
    expect(timingSafeEqualStrings(SECRET, SECRET)).toBe(true);
  });

  it("recusa strings diferentes de mesmo tamanho", () => {
    expect(timingSafeEqualStrings(SECRET, `${SECRET.slice(0, -1)}X`)).toBe(false);
  });

  // Sair cedo pelo `length` vazaria por timing o tamanho do segredo; a função
  // roda a comparação mesmo no caso de tamanhos diferentes.
  it("recusa strings de tamanhos diferentes sem lançar", () => {
    expect(timingSafeEqualStrings("curto", SECRET)).toBe(false);
    expect(timingSafeEqualStrings(SECRET, "")).toBe(false);
  });
});

describe("isValidServiceToken", () => {
  it("aceita o token correto", () => {
    expect(isValidServiceToken(SECRET, SECRET)).toBe(true);
  });

  it("recusa token errado", () => {
    expect(isValidServiceToken(SECRET, "outro-token")).toBe(false);
  });

  // Ausência de credencial nunca autoriza: sem esta guarda, um ambiente sem
  // `SERVICE_SECRET` configurado aceitaria requisição sem token algum.
  it("recusa quando o segredo não está configurado, mesmo sem token", () => {
    expect(isValidServiceToken(undefined, undefined)).toBe(false);
    expect(isValidServiceToken(null, "qualquer")).toBe(false);
    expect(isValidServiceToken("", "")).toBe(false);
  });

  it("recusa token ausente ou de tipo inesperado", () => {
    expect(isValidServiceToken(SECRET, undefined)).toBe(false);
    expect(isValidServiceToken(SECRET, "")).toBe(false);
    expect(isValidServiceToken(SECRET, ["a", "b"])).toBe(false);
    expect(isValidServiceToken(SECRET, 42)).toBe(false);
  });
});
