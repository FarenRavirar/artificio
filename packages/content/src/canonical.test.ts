// Guarda de regressão da spec 102 T3.1: impedir que volte a existir canonical apontando para
// host diferente de artificiorpg.com — a forma exata do resíduo que tirou 105 posts do índice.
import { describe, expect, it } from "vitest";
import { isCanonicalSafe, normalizeCanonical } from "./canonical.js";

describe("normalizeCanonical", () => {
  it("trata vazio como default correto (fallback auto-referente)", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(normalizeCanonical(v)).toEqual({ value: null });
    }
  });

  it("rejeita canonical com host externo", () => {
    const r = normalizeCanonical("https://artificiorpg.com.br/2021/05/post/");
    expect(r.value).toBeNull();
    expect(r.error).toContain("host externo");
  });

  it("rejeita o formato legado do WordPress importado", () => {
    // Forma medida em produção (105 linhas): host do WP antigo, não o domínio canônico.
    const r = normalizeCanonical("https://www.artificio.blog/2022/03/mesa-de-rpg/");
    expect(r.value).toBeNull();
    expect(r.error).toContain("host externo");
  });

  it("aceita e normaliza URL do domínio canônico", () => {
    expect(normalizeCanonical("http://artificiorpg.com/blog/meu-post").value)
      .toBe("https://artificiorpg.com/blog/meu-post/");
  });

  it("aceita subdomínio do domínio canônico", () => {
    expect(normalizeCanonical("https://mesas.artificiorpg.com/mesa/abc/").value)
      .toBe("https://mesas.artificiorpg.com/mesa/abc/");
  });

  it("rejeita valor que não é URL absoluta", () => {
    const r = normalizeCanonical("/blog/meu-post/");
    expect(r.value).toBeNull();
    expect(r.error).toContain("URL absoluta");
  });

  it("rejeita host que apenas termina com o domínio sem ser subdomínio", () => {
    const r = normalizeCanonical("https://evilartificiorpg.com/blog/x/");
    expect(r.error).toContain("host externo");
  });
});

describe("isCanonicalSafe", () => {
  it("considera seguro o canonical vazio", () => {
    expect(isCanonicalSafe(null)).toBe(true);
    expect(isCanonicalSafe("")).toBe(true);
  });

  it("considera inseguro qualquer host externo persistido", () => {
    expect(isCanonicalSafe("https://exemplo.com/post/")).toBe(false);
  });

  it("considera seguro o domínio canônico", () => {
    expect(isCanonicalSafe("https://artificiorpg.com/blog/x/")).toBe(true);
  });
});
