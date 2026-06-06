// Sanitização robusta do corpo autorado (spec 011, achado de revisão: regex não basta).
// Allowlist explícita via sanitize-html. Remove handlers, scripts, esquemas perigosos (javascript:, data: em href),
// atributos fora da lista. Saída cai no SSG público (set:html) — XSS aqui é inaceitável.
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "hr", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "strong", "em", "b", "i", "u", "s", "del", "ins", "mark", "sup", "sub", "small", "abbr",
  "a", "img", "figure", "figcaption",
  "audio", "video", "source",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "span", "div",
];

const CONFIG: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    audio: ["controls", "src"],
    video: ["controls", "src", "width", "height", "poster"],
    source: ["src", "type"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    code: ["class"], // realce de linguagem (language-*)
    "*": ["id", "class"],
  },
  // Esquemas seguros; SEM javascript: e SEM data: em href. img/audio/video só http(s).
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"], source: ["http", "https"], audio: ["http", "https"], video: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    // Links com target=_blank ganham rel seguro; demais mantêm rel existente.
    a: (tagName, attribs) => {
      const out = { ...attribs };
      if (out.target === "_blank") {
        out.rel = Array.from(new Set(`${out.rel ?? ""} noopener noreferrer`.trim().split(/\s+/))).join(" ");
      }
      return { tagName, attribs: out };
    },
  },
};

/** Sanitiza HTML de conteúdo autorado/importado. Allowlist; sem script/handlers/js:/data: href. */
export function cleanHtml(html: string): string {
  return sanitizeHtml(html || "", CONFIG);
}
