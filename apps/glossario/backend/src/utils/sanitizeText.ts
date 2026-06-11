/**
 * sanitizeText.ts — Utilitário de sanitização de texto para o backend Node.js
 *
 * Port fiel de frontend/src/utils/textSanitizer.ts, sem dependências de DOM.
 * Aplicar em todos os controllers que gravam campos de texto em `terms`.
 *
 * Campos que recebem sanitizeInlineText : name_en, name_pt, book_reference, page_reference
 * Campos que recebem decodeHtmlEntities : additional_info
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  amp:  '&',
  apos: "'",
  quot: '"',
  lt:   '<',
  gt:   '>',
  nbsp: ' ',
};

/**
 * Uma passagem de decodificação de entidades HTML.
 * Cobre: \uXXXX, &#xHEX;, &#DEC;, &named;
 */
const decodeCodePoint = (code: number, fallback: string): string => {
  if (!Number.isInteger(code) || code < 0 || code > 0x10FFFF) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
};

const decodeOnce = (input: string): string =>
  input
    // Sequências Unicode escapadas tipo '
    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? match : decodeCodePoint(code, match);
    })
    // Entidades hexadecimais &#x1F;
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? match : decodeCodePoint(code, match);
    })
    // Entidades decimais &#39;
    .replace(/&#(\d+);/g, (match, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isNaN(code) ? match : decodeCodePoint(code, match);
    })
    // Entidades nomeadas: &amp; &apos; &quot; &lt; &gt; &nbsp;
    .replace(/&(amp|apos|quot|lt|gt|nbsp);?/gi, (match, entity: string) => {
      return HTML_ENTITY_MAP[entity.toLowerCase()] ?? match;
    });

/**
 * Decodifica entidades HTML em até 3 passagens (para casos de dupla codificação).
 * Ex: &amp;apos; → &apos; → '
 */
export const decodeHtmlEntities = (value: string | null | undefined): string => {
  if (value == null || value === '') return '';

  let decoded = String(value);
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
};

/**
 * Decodifica + normaliza espaços + trim.
 * Use para campos de linha única: name_en, name_pt, book_reference, page_reference.
 */
export const sanitizeInlineText = (value: string | null | undefined): string =>
  decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();

/**
 * Sanitiza os campos de texto de um objeto de termo antes de gravá-lo no banco.
 * Retorna novo objeto com os campos limpos; não muta o original.
 */
export const sanitizeTermFields = <
  T extends {
    name_en?: string | null;
    name_pt?: string | null;
    book_reference?: string | null;
    page_reference?: string | null;
    additional_info?: string | null;
  }
>(
  term: T
): T => ({
  ...term,
  name_en:         term.name_en         != null ? sanitizeInlineText(term.name_en)         : term.name_en,
  name_pt:         term.name_pt         != null ? sanitizeInlineText(term.name_pt)         : term.name_pt,
  book_reference:  term.book_reference  != null ? sanitizeInlineText(term.book_reference)  : term.book_reference,
  page_reference:  term.page_reference  != null ? sanitizeInlineText(term.page_reference)  : term.page_reference,
  additional_info: term.additional_info != null ? decodeHtmlEntities(term.additional_info) : term.additional_info,
});
