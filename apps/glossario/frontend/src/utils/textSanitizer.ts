import { Termo } from '../types/glossario';

const htmlEntityMap: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

const decodeCodePoint = (code: number, fallback: string): string => {
  if (!Number.isInteger(code) || code < 0 || code > 0x10FFFF) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
};

const decodeOnce = (input: string): string => {
  return input
    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? match : decodeCodePoint(code, match);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? match : decodeCodePoint(code, match);
    })
    .replace(/&#(\d+);/g, (match, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isNaN(code) ? match : decodeCodePoint(code, match);
    })
    .replace(/&(amp|apos|quot|lt|gt|nbsp);?/gi, (match, entity: string) => {
      return htmlEntityMap[entity.toLowerCase()] ?? match;
    });
};

export const decodeHtmlEntities = (value: string | null | undefined): string => {
  if (!value) return '';

  let decoded = String(value);
  for (let i = 0; i < 3; i += 1) {
    const next = decodeOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
};

export const sanitizeInlineText = (value: string | null | undefined): string => {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
};

export const sanitizeTermForUi = (term: Termo): Termo => {
  const sanitizedNameEn = sanitizeInlineText(term.name_en || term.nome_en || '');
  const sanitizedNamePt = sanitizeInlineText(term.name_pt || term.nome_pt || '');

  return {
    ...term,
    name_en: sanitizedNameEn,
    name_pt: sanitizedNamePt,
    nome_en: typeof term.nome_en === 'string' ? sanitizedNameEn : term.nome_en,
    nome_pt: typeof term.nome_pt === 'string' ? sanitizedNamePt : term.nome_pt,
    category_name: term.category_name ? sanitizeInlineText(term.category_name) : term.category_name,
    subcategory_name: term.subcategory_name ? sanitizeInlineText(term.subcategory_name) : term.subcategory_name,
    system_name: term.system_name ? sanitizeInlineText(term.system_name) : term.system_name,
    edition_name: term.edition_name ? sanitizeInlineText(term.edition_name) : term.edition_name,
    scenario_name: term.scenario_name ? sanitizeInlineText(term.scenario_name) : term.scenario_name,
    additional_info: term.additional_info ? decodeHtmlEntities(term.additional_info) : term.additional_info,
    informacao: term.informacao ? decodeHtmlEntities(term.informacao) : term.informacao,
    book_reference: term.book_reference ? sanitizeInlineText(term.book_reference) : term.book_reference,
    page_reference: term.page_reference ? sanitizeInlineText(term.page_reference) : term.page_reference,
    added_by_name: term.added_by_name ? sanitizeInlineText(term.added_by_name) : term.added_by_name,
  };
};
