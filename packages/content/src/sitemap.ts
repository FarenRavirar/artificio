import type { SitemapEntry } from "./types.js";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Gera sitemap.xml a partir de entradas. P/ módulos não-Astro (mesas/glossário);
 *  o site usa @astrojs/sitemap (auto). */
export function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.url)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority != null) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
