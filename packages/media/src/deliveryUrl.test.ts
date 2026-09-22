import { describe, expect, it } from "vitest";
import { IMAGE_KINDS } from "./imageKinds.js";
import {
  cloudinaryDeliveryUrl,
  cloudinarySrcset,
  imageKindWidths,
} from "./deliveryUrl.js";

/**
 * URL real de produção, copiada da resposta da API (`banner_url` de um perfil
 * de mestre). Usar a forma real importa: a inserção acontece por posição de
 * segmento, e uma URL inventada poderia não trazer o `v<n>` que produção traz.
 */
const URL_REAL =
  "https://res.cloudinary.com/dnln0btbo/image/upload/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg";

describe("cloudinaryDeliveryUrl", () => {
  it("insere `q_auto/f_auto/w_<n>` entre `upload` e o segmento de versão", () => {
    expect(cloudinaryDeliveryUrl(URL_REAL, 800)).toBe(
      "https://res.cloudinary.com/dnln0btbo/image/upload/q_auto/f_auto/w_800,c_limit/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg",
    );
  });

  it("insere também quando a URL não traz segmento de versão", () => {
    const semVersao = "https://res.cloudinary.com/dnln0btbo/image/upload/mesas_rpg/abc123.jpg";
    expect(cloudinaryDeliveryUrl(semVersao, 400)).toBe(
      "https://res.cloudinary.com/dnln0btbo/image/upload/q_auto/f_auto/w_400,c_limit/mesas_rpg/abc123.jpg",
    );
  });

  it.each([
    ["host de terceiro", "https://exemplo.com/image/upload/v1/foto.jpg"],
    ["Cloudinary de outra conta, pasta desconhecida", "https://res.cloudinary.com/demo/image/upload/v1/foto.jpg"],
    ["Google User Content", "https://lh3.googleusercontent.com/a/abc=s96-c"],
    ["texto que não é URL", "não é url"],
  ])("devolve intacta: %s", (_caso, url) => {
    expect(cloudinaryDeliveryUrl(url, 800)).toBe(url);
  });

  it("não empilha uma segunda transformação em URL que já tem uma", () => {
    // `isArtificioHostedImage` reconhece esta URL como nossa (ele pula os
    // segmentos de transformação), então quem barra aqui é a guarda desta
    // função — não o predicado. Sem ela, o `w_400` entraria na frente do
    // `w_1200` e mudaria um tamanho que outra pessoa escolheu.
    const jaTransformada =
      "https://res.cloudinary.com/dnln0btbo/image/upload/w_1200,c_fill/v1788537783/artificio_profile_banners/abc.jpg";
    expect(cloudinaryDeliveryUrl(jaTransformada, 400)).toBe(jaTransformada);
  });

  it("é idempotente: a URL que a função produziu não recebe outra transformação", () => {
    const primeira = cloudinaryDeliveryUrl(URL_REAL, 800);
    expect(primeira).not.toBe(URL_REAL);
    expect(cloudinaryDeliveryUrl(primeira, 400)).toBe(primeira);
  });

  it.each([0, -100, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "devolve intacta com largura inválida (%s)",
    (largura) => {
      expect(cloudinaryDeliveryUrl(URL_REAL, largura)).toBe(URL_REAL);
    },
  );

  it("não confunde nome de pasta nossa com componente de transformação", () => {
    // `artificio_avatars` casa com `<algo>_<algo>`; a sigla de transformação
    // tem no máximo 3 caracteres, e é isso que separa os dois casos.
    const avatar = "https://res.cloudinary.com/dnln0btbo/image/upload/artificio_avatars/abc.jpg";
    expect(cloudinaryDeliveryUrl(avatar, 280)).toContain("/upload/q_auto/f_auto/w_280,c_limit/artificio_avatars/");
  });

  /**
   * Sem modo de corte o Cloudinary aplica `c_scale`, que AMPLIA quando o pedido
   * passa do arquivo gravado. Medido em 2026-09-22 contra o Cloudinary real, num
   * avatar de 241×250: `w_746` sem `c_` devolveu 746×774 com **127 KiB**, contra
   * **24 KiB** do original — 5× o peso sem um pixel de detalhe, e um `srcset`
   * declarando largura que o bitmap não tem. Com `c_limit`, devolveu o original.
   *
   * Vale para todo consumidor, porque nenhum deles sabe a dimensão do que o dono
   * subiu: `storageTransformation` grava com `crop: "limit"` e preserva a
   * proporção original (medidos em produção: 715×893, 768×1024, 241×250).
   */
  it("pede com `c_limit`, para largura acima do original não virar upscale", () => {
    const resultado = cloudinaryDeliveryUrl(URL_REAL, 4000);
    expect(resultado).toContain("w_4000,c_limit");
    expect(resultado).not.toContain("c_scale");
  });
});

describe("cloudinarySrcset", () => {
  it("monta uma entrada por largura, em ordem crescente", () => {
    expect(cloudinarySrcset(URL_REAL, [800, 400])).toBe(
      [
        "https://res.cloudinary.com/dnln0btbo/image/upload/q_auto/f_auto/w_400,c_limit/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg 400w",
        "https://res.cloudinary.com/dnln0btbo/image/upload/q_auto/f_auto/w_800,c_limit/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg 800w",
      ].join(", "),
    );
  });

  it("colapsa largura repetida", () => {
    expect(cloudinarySrcset(URL_REAL, [400, 400, 400]).split(", ")).toHaveLength(1);
  });

  it("devolve vazio para URL de terceiro", () => {
    expect(cloudinarySrcset("https://exemplo.com/foto.jpg", [400, 800])).toBe("");
  });

  it("devolve vazio quando a URL já tem transformação", () => {
    const jaTransformada =
      "https://res.cloudinary.com/dnln0btbo/image/upload/w_1200/v1788537783/mesas_rpg/abc.jpg";
    // Declarar a MESMA URL em várias larguras faria o navegador acreditar na
    // declaração e escolher um arquivo que não existe naquele tamanho.
    expect(cloudinarySrcset(jaTransformada, [400, 800])).toBe("");
  });
});

describe("imageKindWidths", () => {
  it.each(["table_banner", "profile_avatar", "profile_banner"] as const)(
    "%s: larguras dentro do contrato do tipo, com ao menos 3 entradas",
    (kind) => {
      const spec = IMAGE_KINDS[kind];
      const larguras = imageKindWidths(kind);

      expect(larguras.length).toBeGreaterThanOrEqual(3);
      expect(larguras[0]).toBe(spec.minWidth);
      expect(larguras[larguras.length - 1]).toBe(spec.maxDimension);
      // Nenhuma largura acima do que existe gravado: `srcset` não declara
      // tamanho que o arquivo não tem.
      expect(larguras.every((largura) => largura <= spec.maxDimension)).toBe(true);
      expect(larguras).toContain(spec.recommendedWidth);
    },
  );

  it("sai ordenada e sem repetição", () => {
    const larguras = imageKindWidths("table_banner");
    expect([...larguras].sort((a, b) => a - b)).toEqual([...larguras]);
    expect(new Set(larguras).size).toBe(larguras.length);
  });

  it("tipo desconhecido cai em `table_banner`, igual `imageKindSpec`", () => {
    expect(imageKindWidths("inexistente")).toEqual(imageKindWidths("table_banner"));
  });
});

describe("cloudinaryDeliveryUrl — recorte no servidor", () => {
  it("põe `ar_` e `c_fill` no MESMO componente, separados por vírgula", () => {
    // Barra é para ação encadeada; `ar_`+`c_fill` são parâmetros da mesma ação.
    expect(cloudinaryDeliveryUrl(URL_REAL, 720, { recortarNaProporcao: "16/9" })).toBe(
      "https://res.cloudinary.com/dnln0btbo/image/upload/q_auto/f_auto/ar_16:9,c_fill/w_720/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg",
    );
  });

  it.each([
    ["barra", "1200/650", "ar_1200:650"],
    ["dois-pontos", "16:10", "ar_16:10"],
    ["com espaço, como o `aspectRatioCss`", "1200 / 650", "ar_1200:650"],
  ])("aceita a proporção escrita com %s", (_caso, entrada, esperado) => {
    expect(cloudinaryDeliveryUrl(URL_REAL, 400, { recortarNaProporcao: entrada })).toContain(esperado);
  });

  it.each(["", "abc", "16/", "/9", "16/0", "-16/9"])(
    "ignora proporção inválida em vez de montar `ar_` quebrado (%s)",
    (proporcao) => {
      const resultado = cloudinaryDeliveryUrl(URL_REAL, 400, { recortarNaProporcao: proporcao });
      expect(resultado).not.toContain("ar_");
      expect(resultado).toContain("/q_auto/f_auto/w_400,c_limit/");
    },
  );

  it("sem a opção não recorta — é o padrão de quem tem `object-position`", () => {
    expect(cloudinaryDeliveryUrl(URL_REAL, 400)).not.toContain("c_fill");
  });

  it("`cloudinarySrcset` repassa o recorte a todas as entradas", () => {
    const srcset = cloudinarySrcset(URL_REAL, [360, 720], { recortarNaProporcao: "16/9" });
    const entradas = srcset.split(", ");
    expect(entradas).toHaveLength(2);
    for (const entrada of entradas) {
      expect(entrada).toContain("ar_16:9,c_fill");
    }
  });
});
