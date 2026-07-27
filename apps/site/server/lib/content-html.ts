// Helpers de HTML de conteúdo: decode de entidades, extração de TOC (ids em h2/h3), reading time.
//
// Morava em `importer/sanitize.ts` até 2026-07-27. O importador do WordPress foi removido (o WP saiu
// do ar; o store Postgres é a fonte de verdade desde o cutover da spec 029/D074), mas estes helpers
// nunca foram do importador: servem o runtime do site, via `server/lib/content.ts`. Mudaram de lugar,
// não de comportamento.
//
// Saíram junto com o importador, por ficarem sem consumidor: `toDate` (normalizava a data localizada
// MM/DD/YYYY da REST do WP) e `sanitize` (wrapper de uma linha sobre `cleanHtml`, que os chamadores
// usam direto de `sanitize-html.ts`). A sanitização de rich-text continua obrigatória — mudou o
// caminho do import, não a regra.
export interface TocItem {
  id: string;
  text: string;
  level: number;
}

// Não exportado: só `stripTags` consome. Era público quando o importador do WP decodificava títulos
// e excerpts vindos da REST; sem esse consumidor, exportar seria superfície morta.
const decode = (s = ""): string =>
  s
    .replace(/&amp;/g, "&").replace(/&#038;/g, "&").replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘").replace(/&#8220;/g, "“").replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—").replace(/&#8230;/g, "…")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8594;/g, "→");

export const stripTags = (h: string): string =>
  decode(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

export const readingTime = (h: string): number =>
  Math.max(1, Math.round(stripTags(h).split(" ").length / 200));

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
