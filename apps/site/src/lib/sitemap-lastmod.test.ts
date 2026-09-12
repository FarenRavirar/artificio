// Guarda do aceite da spec 102 T3.4: lastmod vem da data real de edição e só existe onde há data.
import { describe, expect, it } from "vitest";
import {
  buildLastmodIndex, postSlugFromUrl, serializeWithLastmod, type LastmodSource,
} from "./sitemap-lastmod.js";

const post = (slug: string, updated?: string): LastmodSource => ({ slug, updated });

describe("buildLastmodIndex", () => {
  it("indexa só posts com data real", () => {
    const index = buildLastmodIndex([
      post("a", "2025-05-28T10:00:00.000Z"),
      post("b", ""),
      post("c"),
      post("d", "não é data"),
    ]);
    expect([...index.keys()]).toEqual(["a"]);
    expect(index.get("a")).toBe("2025-05-28T10:00:00.000Z");
  });
});

describe("postSlugFromUrl", () => {
  it("extrai slug de post", () => {
    expect(postSlugFromUrl("https://artificiorpg.com/blog/meu-post/")).toBe("meu-post");
  });

  it("ignora listagens e páginas sem data própria", () => {
    for (const url of [
      "https://artificiorpg.com/",
      "https://artificiorpg.com/blog/",
      "https://artificiorpg.com/blog/categoria/noticias/",
      "https://artificiorpg.com/blog/tag/dnd/",
      "https://artificiorpg.com/busca/",
    ]) {
      expect(postSlugFromUrl(url)).toBeNull();
    }
  });
});

describe("serializeWithLastmod", () => {
  const index = buildLastmodIndex([
    post("post-antigo", "2025-02-02T00:19:37.000Z"),
    post("post-novo", "2026-09-02T14:54:26.804Z"),
    post("sem-data", ""),
  ]);

  it("preenche lastmod do post com data real", () => {
    expect(serializeWithLastmod({ url: "https://artificiorpg.com/blog/post-antigo/" }, index))
      .toEqual({ url: "https://artificiorpg.com/blog/post-antigo/", lastmod: "2025-02-02T00:19:37.000Z" });
  });

  it("dá lastmod DIFERENTE a posts editados em datas diferentes", () => {
    // Guarda contra "data do build para todas as URLs", que o Google ignora.
    const a = serializeWithLastmod({ url: "https://artificiorpg.com/blog/post-antigo/" }, index).lastmod;
    const b = serializeWithLastmod({ url: "https://artificiorpg.com/blog/post-novo/" }, index).lastmod;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });

  it("não inventa lastmod para URL sem data real", () => {
    for (const url of [
      "https://artificiorpg.com/",
      "https://artificiorpg.com/blog/",
      "https://artificiorpg.com/blog/sem-data/",
      "https://artificiorpg.com/blog/categoria/noticias/",
    ]) {
      expect(serializeWithLastmod({ url }, index).lastmod).toBeUndefined();
    }
  });
});
