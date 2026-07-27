import DOMPurify from 'isomorphic-dompurify';
import { decodeHtml5PlainText } from './scrapers/plainTextPolicy';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'img', 'h2', 'h3', 'h4', 'blockquote', 'hr'];
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height'];
const HTTP_URL_RE = /^https?:/i;
const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'tr', 'hr']);

// Spec 086, Fase 2: HTML vindo de marketplace/edição é hostil. Achado real
// (review PR #203, Codex, P2): AGENTS.md exige DOMPurify na fronteira de
// persistência/renderização; esta configuração também restringe URLs a HTTP(S).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const tagName = node.nodeName.toLowerCase();
  // Achado real (review PR #203): ALLOWED_URI_REGEXP do DOMPurify não cobre
  // img[src] neste build — "data:image/..." sobrevive à sanitização. Remove
  // src fora de HTTP(S) manualmente para manter o contrato desta config.
  if (tagName === 'img' && node.hasAttribute('src') && !HTTP_URL_RE.test(node.getAttribute('src') ?? '')) {
    node.removeAttribute('src');
    return;
  }
  if (tagName !== 'a' || !node.hasAttribute('href')) return;
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'nofollow noopener noreferrer');
});

function findTagEnd(value: string, start: number): number {
  let quote: string | null = null;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  return -1;
}

function getTagName(tag: string): string {
  const match = /^<\s*\/?\s*([a-z][a-z0-9:-]*)\b/i.exec(tag);
  return match?.[1].toLowerCase() ?? '';
}

// Scanner linear: HTML externo pode conter atributos longos/malformados; regex
// com classes amplas tinha backtracking super-linear (Sonar, PR fase 4).
function replaceHtmlTags(value: string, replacement: (tagName: string) => string | null): string {
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    const tagStart = value.indexOf('<', cursor);
    if (tagStart === -1) return output + value.slice(cursor);
    output += value.slice(cursor, tagStart);
    const tagEnd = findTagEnd(value, tagStart);
    if (tagEnd === -1) return output + value.slice(tagStart);
    const tag = value.slice(tagStart, tagEnd + 1);
    const tagName = getTagName(tag);
    output += replacement(tagName) ?? tag;
    cursor = tagEnd + 1;
  }
  return output;
}

function removeIframeTags(value: string): string {
  return replaceHtmlTags(value, (tagName) => (tagName === 'iframe' ? '' : null));
}

function stripHtmlTags(value: string): string {
  return replaceHtmlTags(value, (tagName) => {
    if (tagName === 'br' || BLOCK_TAGS.has(tagName)) return '\n';
    return '';
  });
}

export function sanitizeRichHtml(html: string): string {
  // sanitize-html com disallowedTagsMode='discard' removia a tag e mantinha
  // texto fallback. DOMPurify trata iframe como conteúdo proibido; desembrulha
  // só a tag antes para preservar o contrato sem permitir o elemento perigoso.
  // Achado CodeQL (github-advanced-security, PR #203): replace de passagem
  // única não pega tag reconstruída por sobreposição (ex.: "<ifr<iframe>ame>");
  // repete até fixpoint antes de entregar ao DOMPurify.
  let withoutIframe = html;
  let previousIframePass: string;
  do {
    previousIframePass = withoutIframe;
    withoutIframe = removeIframeTags(withoutIframe);
  } while (withoutIframe !== previousIframePass);
  return DOMPurify.sanitize(withoutIframe, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP: HTTP_URL_RE });
}

// Achado real (review PR #203, Codex, P2): sanitizeText remove tags e
// entidades, juntando parágrafos como "D&amp;D5e". Texto derivado de HTML rico
// preserva separadores de bloco e decodifica entidades antes de busca/SEO.
export function richHtmlToEncodedPlainText(html: string): string {
  const sanitizedHtml = sanitizeRichHtml(html);
  // Achado CodeQL (github-advanced-security, PR #203): mesma classe do fix acima
  // — strip de tag em cadeia única deixa resíduo reconstruído por sobreposição;
  // repete até fixpoint.
  let stripped = sanitizedHtml;
  let previousStripPass: string;
  do {
    previousStripPass = stripped;
    stripped = stripHtmlTags(stripped);
  } while (stripped !== previousStripPass);
  return stripped
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function richHtmlToPlainText(html: string): string {
  return decodeHtml5PlainText(richHtmlToEncodedPlainText(html));
}
