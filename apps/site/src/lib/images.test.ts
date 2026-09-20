import { describe, expect, it } from "vitest";
import { optimizedImageUrl, responsiveSrcSet } from "./images";

/**
 * Este arquivo não tinha teste nenhum antes da spec 103 (T2.4), o que deixou
 * cinco divergências contra a doc e contra o pacote passarem sem ruído.
 */

/** Capa hospedada na nossa conta. A pasta é o que a torna reconhecível. */
const CAPA_NOSSA =
  "https://res.cloudinary.com/dnln0btbo/image/upload/v1788537783/mesas_rpg/capa.jpg";

describe("optimizedImageUrl", () => {
  it("pede o tamanho e recorta na proporção do card", () => {
    const url = optimizedImageUrl(CAPA_NOSSA, 720);
    // Recorte no servidor é INTENCIONAL aqui: capa de post não tem
    // enquadramento de dono para preservar.
    expect(url).toContain("/q_auto/f_auto/ar_16:9,c_fill/w_720/");
  });

  it("separa `q_auto` e `f_auto` por barra, como a doc oficial pede", () => {
    expect(optimizedImageUrl(CAPA_NOSSA, 360)).toContain("/q_auto/f_auto/");
    expect(optimizedImageUrl(CAPA_NOSSA, 360)).not.toContain("f_auto,q_auto");
  });

  it("não reescreve o caminho de conta que não é nossa", () => {
    // A versão anterior aceitava qualquer `res.cloudinary.com` e reescrevia o
    // caminho de terceiro, produzindo 404.
    const terceiro = "https://res.cloudinary.com/outraconta/image/upload/v1/foto.jpg";
    expect(optimizedImageUrl(terceiro, 720)).toBe(terceiro);
  });

  it.each([
    ["URL do WordPress legado", "https://artificiorpg.com/wp-content/uploads/2026/01/capa.webp"],
    ["caminho relativo", "/og-default.png"],
  ])("devolve intacta: %s", (_caso, url) => {
    expect(optimizedImageUrl(url, 720)).toBe(url);
  });

  it("string vazia volta vazia, sem montar URL", () => {
    expect(optimizedImageUrl("", 720)).toBe("");
  });

  it("é idempotente — duas chamadas não empilham `w_`", () => {
    const uma = optimizedImageUrl(CAPA_NOSSA, 720);
    expect(optimizedImageUrl(uma, 360)).toBe(uma);
  });
});

describe("responsiveSrcSet", () => {
  it("monta uma entrada por largura, com o descritor `w`", () => {
    const entradas = responsiveSrcSet(CAPA_NOSSA).split(", ");
    expect(entradas.length).toBeGreaterThanOrEqual(3);
    for (const entrada of entradas) {
      expect(entrada).toMatch(/ \d+w$/);
      expect(entrada).toContain("ar_16:9,c_fill");
    }
  });

  it("aceita larguras informadas pelo chamador", () => {
    expect(responsiveSrcSet(CAPA_NOSSA, [400]).split(", ")).toHaveLength(1);
  });

  it.each(["", "https://artificiorpg.com/wp-content/uploads/2026/01/capa.webp"])(
    "devolve vazio quando não há o que otimizar: %s",
    (url) => {
      expect(responsiveSrcSet(url)).toBe("");
    },
  );
});
