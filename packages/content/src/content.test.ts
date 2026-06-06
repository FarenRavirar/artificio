import { describe, expect, it } from "vitest";
import { buildMeta, articleLd, breadcrumbLd, robotsTxt, sitemapXml, SITE } from "./index.js";

describe("buildMeta", () => {
  it("gera og + twitter + description", () => {
    const tags = buildMeta({ title: "T", description: "D", canonical: "https://x/y/", type: "article", image: "https://x/i.jpg" });
    expect(tags.find((t) => t.property === "og:type")?.content).toBe("article");
    expect(tags.find((t) => t.property === "og:image")?.content).toBe("https://x/i.jpg");
    expect(tags.find((t) => t.name === "twitter:card")?.content).toBe("summary_large_image");
    expect(tags.find((t) => t.name === "description")?.content).toBe("D");
  });
  it("sem imagem usa twitter summary", () => {
    const tags = buildMeta({ title: "T", description: "D", canonical: "https://x/" });
    expect(tags.find((t) => t.name === "twitter:card")?.content).toBe("summary");
    expect(tags.some((t) => t.property === "og:image")).toBe(false);
  });
});

describe("jsonld", () => {
  it("articleLd tem headline + publisher", () => {
    const ld = articleLd({ headline: "H", url: "https://x/p/", datePublished: "2026-01-01" }) as Record<string, unknown>;
    expect(ld["@type"]).toBe("Article");
    expect(ld.headline).toBe("H");
    expect((ld.publisher as Record<string, unknown>).name).toBe(SITE.name);
  });
  it("breadcrumbLd numera posições 1..n", () => {
    const ld = breadcrumbLd([{ name: "A", url: "https://x/" }, { name: "B", url: "https://x/b/" }]) as Record<string, unknown>;
    const items = ld.itemListElement as { position: number }[];
    expect(items.map((i) => i.position)).toEqual([1, 2]);
  });
});

describe("sitemap + robots", () => {
  it("sitemapXml escapa & e lista loc", () => {
    const xml = sitemapXml([{ url: "https://x/a?b=1&c=2", priority: 0.8 }]);
    expect(xml).toContain("<loc>https://x/a?b=1&amp;c=2</loc>");
    expect(xml).toContain("<priority>0.8</priority>");
  });
  it("robotsTxt aponta sitemap", () => {
    const r = robotsTxt({ sitemap: "https://x/sitemap.xml" });
    expect(r).toContain("Sitemap: https://x/sitemap.xml");
    expect(r).toContain("Allow: /");
  });
});
