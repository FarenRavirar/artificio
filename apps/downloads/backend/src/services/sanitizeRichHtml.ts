import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'img', 'h2', 'h3', 'h4', 'blockquote', 'hr'];
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height'];
const HTTP_URL_RE = /^https?:/i;
const IFRAME_TAG_RE = /<\/?iframe\b[^>]*>/gi;
const BLOCK_TAG_RE = /<\/?(?:p|div|section|article|h[1-6]|ul|ol|li|blockquote|pre|table|tr|hr)\b[^>]*>/gi;
const BREAK_TAG_RE = /<br\b[^>]*>/gi;
const HTML_TAG_RE = /<[^>]*>/g;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
};

// Spec 086, Fase 2: HTML vindo de marketplace/edição é hostil. Achado real
// (review PR #203, Codex, P2): AGENTS.md exige DOMPurify na fronteira de
// persistência/renderização; esta configuração também restringe URLs a HTTP(S).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName.toLowerCase() !== 'a' || !node.hasAttribute('href')) return;
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'nofollow noopener noreferrer');
});

export function sanitizeRichHtml(html: string): string {
  // sanitize-html com disallowedTagsMode='discard' removia a tag e mantinha
  // texto fallback. DOMPurify trata iframe como conteúdo proibido; desembrulha
  // só a tag antes para preservar o contrato sem permitir o elemento perigoso.
  return DOMPurify.sanitize(html.replace(IFRAME_TAG_RE, ''), { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP: HTTP_URL_RE });
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    const normalizedToken = token.toLowerCase();
    if (normalizedToken in NAMED_ENTITIES) return NAMED_ENTITIES[normalizedToken]!;
    const codePoint = normalizedToken.startsWith('#x')
      ? Number.parseInt(normalizedToken.slice(2), 16)
      : normalizedToken.startsWith('#') ? Number.parseInt(normalizedToken.slice(1), 10) : Number.NaN;
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    return String.fromCodePoint(codePoint);
  });
}

// Achado real (review PR #203, Codex, P2): sanitizeText remove tags e
// entidades, juntando parágrafos como "D&amp;D5e". Texto derivado de HTML rico
// preserva separadores de bloco e decodifica entidades antes de busca/SEO.
export function richHtmlToPlainText(html: string): string {
  const sanitizedHtml = sanitizeRichHtml(html);
  return decodeHtmlEntities(sanitizedHtml.replace(BREAK_TAG_RE, '\n').replace(BLOCK_TAG_RE, '\n').replace(HTML_TAG_RE, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
