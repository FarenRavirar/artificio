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

  // Comprimento não chega ao comparador: SHA-256 normaliza todo par em 32 bytes,
  // então existe um caminho de execução só, sem ramo por tamanho (achado de
  // review, PR #234).
  it("recusa strings de tamanhos diferentes sem lançar", () => {
    expect(timingSafeEqualStrings("curto", SECRET)).toBe(false);
    expect(timingSafeEqualStrings(SECRET, "")).toBe(false);
    expect(timingSafeEqualStrings("", SECRET)).toBe(false);
    expect(timingSafeEqualStrings(`${SECRET}${SECRET}`, SECRET)).toBe(false);
  });

  it("compara o valor, não o prefixo: token que começa igual é recusado", () => {
    expect(timingSafeEqualStrings(SECRET.slice(0, 10), SECRET)).toBe(false);
    expect(timingSafeEqualStrings(`${SECRET}x`, SECRET)).toBe(false);
  });

  it("trata caracteres não-ASCII de forma consistente", () => {
    expect(timingSafeEqualStrings("segredo-ção", "segredo-ção")).toBe(true);
    expect(timingSafeEqualStrings("segredo-ção", "segredo-cao")).toBe(false);
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
