import sanitizeHtml from 'sanitize-html';

// Spec 086, Fase 2: HTML vindo de marketplace/edição é hostil. A garantia
// fica no backend antes de persistir e servir; sanitizeText continua sendo
// o caminho correto dos campos estritamente textuais da spec 075.
const RICH_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'img', 'h2', 'h3', 'h4', 'blockquote', 'hr'],
  allowedAttributes: {
    // target/rel entram só para reter os valores seguros fixados abaixo.
    // Todo <a> passa pelo transform, então input não escolhe esses valores.
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https'],
  allowedSchemesByTag: {
    a: ['http', 'https'],
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        href: attribs.href,
        title: attribs.title,
        target: '_blank',
        rel: 'nofollow noopener noreferrer',
      },
    }),
  },
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, RICH_HTML_OPTIONS);
}
