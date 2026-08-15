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

// Tabela de entidades do `decode`. Era uma cadeia de `.replace()` até 2026-08-14,
// quando o CodeQL apontou double-unescaping (`js/double-escaping`, alertas 258/259):
// numa cadeia, `&amp;` vira `&` no primeiro passo e realimenta as regras seguintes,
// então `&amp;lt;script&amp;gt;` — o texto literal `&lt;script&gt;` digitado pelo
// autor — saía como `<script>` (medido). A passada única de `replace` abaixo
// resolve por construção: cada ocorrência é consumida uma vez só, e a saída de
// uma substituição nunca é reexaminada. Coberto por `content-html.test.ts`.
const ENTITIES: Record<string, string> = {
  "&#8217;": "’", "&#8216;": "‘", "&#8220;": "“", "&#8221;": "”",
  "&#8211;": "–", "&#8212;": "—", "&#8230;": "…", "&#8594;": "→",
  // `&#039;` (zero à esquerda) precisa de chave própria: o regex abaixo casa
  // `#0?39`, então a forma acolchoada do WordPress chega aqui como `match`, e
  // sem entrada no mapa o `?? match` a devolvia intacta (regressão introduzida
  // em 4d15b01, medida: `&#039;` saía `&#039;` em vez de `'`).
  "&#39;": "'", "&#039;": "'", "&quot;": '"', "&nbsp;": " ",
  "&lt;": "<", "&gt;": ">",
  "&amp;": "&", "&#038;": "&",
};

// Não exportado: só `stripTags` consome. Era público quando o importador do WP
// decodificava títulos e excerpts vindos da REST; sem esse consumidor, exportar
// seria superfície morta.
const decode = (s = ""): string =>
  s.replace(/&(?:amp|lt|gt|quot|nbsp|#0?39|#038|#821[1267]|#822[01]|#8230|#8594);/g,
    (match) => ENTITIES[match] ?? match);

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
