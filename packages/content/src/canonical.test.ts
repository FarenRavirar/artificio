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

  // Parametrizado (achado do Sonar na PR #316): os casos diferem só pela URL de
  // entrada, e a lista deixa explícito que `artificiorpg.com.br` — um domínio que
  // PARECE nosso — cai no mesmo lado de um host claramente alheio.
  it.each([
    ["domínio que só prefixa o nosso", "https://artificiorpg.com.br/2021/05/post/"],
    // Forma medida em produção (105 linhas): host do WP antigo, não o domínio canônico.
    ["formato legado do WordPress importado", "https://www.artificio.blog/2022/03/mesa-de-rpg/"],
  ])("rejeita canonical com host externo — %s", (_caso, url) => {
    const r = normalizeCanonical(url);
    expect(r.value).toBeNull();
    expect(r.error).toContain("host externo");
  });

  it("rejeita entrada que não é texto", () => {
    // `String({})` daria "[object Object]" e a mensagem culparia o formato da URL.
    for (const v of [{}, [], 42, true]) {
      expect(normalizeCanonical(v)).toEqual({ value: null, error: "canonical deve ser texto" });
    }
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

  // Achado do CodeRabbit na PR #317. Duas formas, e as duas passavam:
  // com host permitido a senha era GRAVADA pelo `url.toString()`; com host
  // externo o `@` disfarçava o destino real para quem lê da esquerda.
  it.each([
    ["host permitido — a senha era persistida", "https://user:senha@artificiorpg.com/x"],
    ["host externo disfarçado por userinfo", "https://artificiorpg.com@evil.example/login"],
    ["só usuário, sem senha", "https://user@artificiorpg.com/x"],
  ])("rejeita canonical com credencial embutida — %s", (_caso, url) => {
    const r = normalizeCanonical(url);
    expect(r.value).toBeNull();
    expect(r.error).toContain("credencial embutida");
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
