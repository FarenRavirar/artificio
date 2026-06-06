// Helpers do importador: decode de entidades, sanitização allowlist (regra pétrea — HTML WP hostil),
// extração de TOC (ids em h2/h3), reading time, datas. Compartilhado entre importer e prep.
import { cleanHtml } from "../server/lib/sanitize-html.js";
export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export const decode = (s = ""): string =>
  s
    .replace(/&amp;/g, "&").replace(/&#038;/g, "&").replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘").replace(/&#8220;/g, "“").replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—").replace(/&#8230;/g, "…")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8594;/g, "→");

/** Sanitização defensiva allowlist; HTML do WP é hostil. */
export function sanitize(html: string): string {
  return cleanHtml(html);
}

export const stripTags = (h: string): string =>
  decode(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

export const readingTime = (h: string): number =>
  Math.max(1, Math.round(stripTags(h).split(" ").length / 200));

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** WP REST devolve data localizada (MM/DD/YYYY ...) ou ISO. Normaliza p/ Date. */
export function toDate(s: string): Date {
  return new Date(s.includes("/") ? s.replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2") : s);
}

/** Injeta ids em h2/h3 e devolve {html, toc}. */
export function withToc(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  let i = 0;
  const out = html.replace(/<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi, (_m, tag: string, attrs: string, inner: string) => {
    const text = stripTags(inner);
    const id =
      "sec-" + i++ + "-" +
      text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    toc.push({ id, text, level: tag.toLowerCase() === "h2" ? 2 : 3 });
    return `<${tag}${attrs} id="${escapeAttr(id)}">${inner}</${tag}>`;
  });
  return { html: out, toc };
}
