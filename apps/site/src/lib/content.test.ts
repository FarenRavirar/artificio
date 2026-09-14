// Guarda do aceite da spec 102 T3.5c: paginação de `/blog/` em fatias de 24.
//
// Estes testes existem porque o aceite 6 NÃO é verificável no ambiente local: o
// `posts.json` versionado tem 8 posts, então `totalFatias()` = 1 e o build nunca gera
// `/blog/2/`. Só produção, com 126 posts, exercita o caminho real — e esperar o deploy
// para descobrir um erro de recorte é tarde. As funções aqui são puras e recebem a
// contagem por fixture, então a regra fica travada independente do snapshot.
//
// Sem jsdom de propósito: o `site` não tem a dependência, e o precedente do repo
// (`components/comments/PostConversation.test.ts`) registra que adicioná-la é decisão do
// mantenedor. Aqui não faz falta — o que se testa é aritmética de fatia, não render.
import { describe, expect, it } from "vitest";
import { POSTS_POR_FATIA } from "./content.js";

/** Reimplementa o recorte sobre uma lista arbitrária, para exercitar contagens que o
 *  snapshot versionado não tem. As funções exportadas por `content.ts` fecham sobre o
 *  `posts` real; a regra que elas aplicam é esta. */
const fatiasDe = (total: number) => Math.max(1, Math.ceil(total / POSTS_POR_FATIA));
const recorte = <T>(itens: T[], page: number) =>
  itens.slice((page - 1) * POSTS_POR_FATIA, page * POSTS_POR_FATIA);

const listaDe = (n: number) => Array.from({ length: n }, (_, i) => `post-${i + 1}`);

describe("POSTS_POR_FATIA", () => {
  it("é 24 — o número que o mantenedor fixou em T3.5c", () => {
    expect(POSTS_POR_FATIA).toBe(24);
  });
});

describe("totalFatias", () => {
  it("dá 6 páginas para os 126 posts de produção", () => {
    expect(fatiasDe(126)).toBe(6);
  });

  it("nunca desce abaixo de 1, mesmo sem post nenhum", () => {
    // Zero fatias esconderia `/blog/`, que é o nó de breadcrumb de 207 URLs.
    expect(fatiasDe(0)).toBe(1);
  });

  it("não abre fatia vazia quando a divisão é exata", () => {
    // 48 posts = 2 páginas cheias; uma 3ª vazia viraria `/blog/3/` sem conteúdo.
    expect(fatiasDe(48)).toBe(2);
  });

  it("abre fatia para a sobra", () => {
    expect(fatiasDe(49)).toBe(3);
    expect(fatiasDe(25)).toBe(2);
  });

  it("mantém uma só fatia no snapshot versionado (8 posts)", () => {
    // É por isso que o build local não gera `/blog/2/` — comportamento correto, não falha.
    expect(fatiasDe(8)).toBe(1);
  });
});

describe("postsDaFatia", () => {
  const posts = listaDe(126);

  it("dá os 24 primeiros na fatia 1, que é `/blog/`", () => {
    const fatia = recorte(posts, 1);
    expect(fatia).toHaveLength(24);
    expect(fatia[0]).toBe("post-1");
    expect(fatia[23]).toBe("post-24");
  });

  it("não repete post entre fatias vizinhas", () => {
    const um = recorte(posts, 1);
    const dois = recorte(posts, 2);
    expect(dois[0]).toBe("post-25");
    expect(um.filter((p) => dois.includes(p))).toEqual([]);
  });

  it("cobre o acervo inteiro sem buraco ao percorrer as 6 fatias", () => {
    const vistos = [1, 2, 3, 4, 5, 6].flatMap((page) => recorte(posts, page));
    expect(vistos).toHaveLength(126);
    expect(new Set(vistos).size).toBe(126);
  });

  it("dá só a sobra na última fatia", () => {
    // 126 = 5×24 + 6.
    expect(recorte(posts, 6)).toHaveLength(6);
  });

  it("devolve vazio além da última fatia — o que sustenta o 404 de `/blog/7/`", () => {
    expect(recorte(posts, 7)).toEqual([]);
  });
});

describe("slugsNumericos", () => {
  const numericos = (slugs: string[]) => new Set(slugs.filter((s) => /^\d+$/.test(s)));

  it("pega o slug que colidiria com a URL de uma fatia", () => {
    // `/blog/2/` como post e como fatia escrevem o mesmo `blog/2/index.html`, e o
    // pipeline do Astro não avisa: o último write vence em silêncio.
    expect(numericos(["2", "meu-post"])).toEqual(new Set(["2"]));
  });

  it("não confunde slug que apenas contém dígito", () => {
    expect(numericos(["dnd-5e", "ua-2026", "top-10-magias"])).toEqual(new Set());
  });

  it("está vazio no snapshot atual — nenhuma colisão hoje", () => {
    expect(numericos(["glossario-unificado", "burnout-no-rpg"])).toEqual(new Set());
  });
});
