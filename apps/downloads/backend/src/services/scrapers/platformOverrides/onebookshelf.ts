// Spec 085 (Fase 7, T7.2) — override da familia OneBookShelf (DMs Guild,
// DriveThruRPG, StorytellersVault, mesmo motor Angular/JSON-LD): sinal real
// de PWYW nao vem do preco, vem da tag <obs-product-format-pwyw-options>
// (achado T0 — texto "Pague quanto quiser" e link de menu, aparece em
// TODOS os fixtures inclusive gratuitos, falso positivo). Mesma logica de
// resolvePriceSignal do onebookshelfHtmlParser.ts original (T1.4),
// preservada aqui, so sobrescreve isFreeOrPwyw/priceSignal — nunca
// title/description/publisherName/coverImageUrl (ja vem certo do JSON-LD
// padrao, generic Schema.org).

import type { PlatformOverrideInput } from './index';
import { richHtmlToPlainText, sanitizeRichHtml } from '../../sanitizeRichHtml';
import { sanitizeText } from '../../sanitizeText';
import type { SourceFilter } from '../types';

const PWYW_TAG_MARKER = 'obs-product-format-pwyw-options';
const TABLE_RE = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
const ROW_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const TD_RE = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
const CODE_ID_RE = /\bdata-codeid\s*=\s*(["'])([^"']+)\1/i;
const CLASS_ATTR_RE = /\bclass\s*=\s*(["'])(.*?)\1/i;
const LI_RE = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
const HREF_ATTR_RE = /\bhref\s*=\s*(["'])([^"']*)\1/i;
const PARAGRAPH_RE = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
const TILE_MARKER_RE = /\bproduct-detail-tile-\d+\b/gi;
const RICH_DESCRIPTION_RE = /<obs-product-description\b[^>]*>([\s\S]*?)<\/obs-product-description>/i;
const FILTER_FACETS = new Set(['tipoDeProduto', 'edicao', 'cenario', 'conteudo']);

function normalizedText(html: string): string {
  return sanitizeText(html.replace(/<br\b[^>]*>/gi, ' ')).replace(/\s+/g, ' ').trim();
}

function nullableText(html: string | undefined): string | null {
  const value = html ? normalizedText(html) : '';
  return value === '' ? null : value;
}

function extractDetailValues(html: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const tableMatch of html.matchAll(TABLE_RE)) {
    const table = tableMatch[0];
    const classMatch = CLASS_ATTR_RE.exec(table);
    if (!classMatch?.[2].split(/\s+/).includes('table-list')) continue;

    for (const rowMatch of tableMatch[1].matchAll(ROW_RE)) {
      const codeId = CODE_ID_RE.exec(rowMatch[1])?.[2];
      if (!codeId) continue;
      const cells = [...rowMatch[1].matchAll(TD_RE)];
      if (cells.length < 2) continue;
      values.set(codeId, cells[1][1]);
    }
  }
  return values;
}

// Achado real (Sonar, performance): regex de <a> combinava múltiplos
// quantificadores amplos sobre HTML externo. Scanner linear evita backtracking.
function extractAnchors(html: string): Array<{ href: string; content: string }> {
  const anchors: Array<{ href: string; content: string }> = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const openStart = lowerHtml.indexOf('<a', cursor);
    if (openStart === -1) break;
    const nextCharacter = lowerHtml[openStart + 2];
    if (nextCharacter !== '>' && !/\s/.test(nextCharacter ?? '')) {
      cursor = openStart + 2;
      continue;
    }

    let quote: string | null = null;
    let openEnd = -1;
    for (let index = openStart + 2; index < html.length; index += 1) {
      const character = html[index];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        openEnd = index;
        break;
      }
    }
    if (openEnd === -1) break;

    const closeStart = lowerHtml.indexOf('</a>', openEnd + 1);
    if (closeStart === -1) {
      cursor = openEnd + 1;
      continue;
    }
    const href = HREF_ATTR_RE.exec(html.slice(openStart, openEnd + 1))?.[2];
    if (href !== undefined) anchors.push({ href, content: html.slice(openEnd + 1, closeStart) });
    cursor = closeStart + 4;
  }
  return anchors;
}

function extractSourceFilters(filtersHtml: string | undefined): SourceFilter[] {
  if (!filtersHtml) return [];
  const filters: SourceFilter[] = [];
  for (const listItem of filtersHtml.matchAll(LI_RE)) {
    let facet: string | null = null;
    let path: string[] = [];
    const flush = () => {
      if (facet && path.length > 0) filters.push({ facet, path });
      facet = null;
      path = [];
    };
    for (const anchor of extractAnchors(listItem[1])) {
      const text = nullableText(anchor.content);
      if (!text) continue;
      let url: URL;
      try {
        url = new URL(anchor.href, 'https://onebookshelf.invalid');
      } catch {
        // HTML externo malformado não pode abortar a extração dos demais filtros.
        continue;
      }
      const nextFacet = [...url.searchParams.keys()].find((key) => FILTER_FACETS.has(key));
      if (!nextFacet) continue;
      if (facet && facet !== nextFacet) flush();
      facet = nextFacet;
      path.push(text);
    }
    flush();
  }
  return filters;
}

function flattenFilterTags(sourceFilters: SourceFilter[]): string[] {
  return [...new Set(sourceFilters.flatMap(({ path }) => path))];
}

function extractTileMetadata(html: string): Pick<PlatformOverrideInput, 'pageCount' | 'sourceCategory'> {
  const markers = [...html.matchAll(TILE_MARKER_RE)];
  let pageCount: number | null = null;
  let sourceCategory: string | null = null;
  for (let index = 0; index < markers.length; index += 1) {
    const start = markers[index].index ?? 0;
    const end = markers[index + 1]?.index ?? Math.min(html.length, start + 4_000);
    const paragraphs = [...html.slice(start, end).matchAll(PARAGRAPH_RE)]
      .map((match) => nullableText(match[1]))
      .filter((value): value is string => value !== null);
    const label = paragraphs[0]?.toLowerCase();
    const value = paragraphs.at(-1);
    if (!label || !value) continue;
    if (label === 'número de páginas' || label === 'page count') {
      const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
      pageCount = Number.isFinite(parsed) ? parsed : null;
    }
    if (label === 'categoria' || label === 'category') sourceCategory = value;
  }
  return { pageCount, sourceCategory };
}

function extractRichDescription(html: string): string | null {
  return RICH_DESCRIPTION_RE.exec(html)?.[1].trim() || null;
}

export function applyOneBookShelfOverride(preview: PlatformOverrideInput, html: string): PlatformOverrideInput {
  const details = extractDetailValues(html);
  const extractedDescriptionHtml = extractRichDescription(html);
  const descriptionHtml = extractedDescriptionHtml ? sanitizeRichHtml(extractedDescriptionHtml) : null;
  const sourceFilters = extractSourceFilters(details.get('filters'));
  const tiles = extractTileMetadata(html);
  const description = descriptionHtml ? richHtmlToPlainText(descriptionHtml) : preview.description;
  const richFields: Pick<PlatformOverrideInput, 'scenario' | 'authorsCredits' | 'artistsCredits' | 'creationMethod' | 'sourceFilters' | 'tags' | 'fileSizeText' | 'format' | 'pageCount' | 'sourceCategory' | 'descriptionHtml' | 'description'> = {
    scenario: nullableText(details.get('ruleSystem')),
    authorsCredits: nullableText(details.get('authors')),
    artistsCredits: nullableText(details.get('artists')),
    creationMethod: nullableText(details.get('creationMethod')),
    sourceFilters,
    tags: flattenFilterTags(sourceFilters),
    fileSizeText: nullableText(details.get('fileSize')),
    format: nullableText(details.get('format')),
    pageCount: tiles.pageCount,
    sourceCategory: tiles.sourceCategory,
    descriptionHtml,
    description,
  };
  if (html.includes(PWYW_TAG_MARKER)) {
    return { ...preview, ...richFields, isFreeOrPwyw: true, priceSignal: 'pwyw_tag_present' };
  }
  if (preview.extractedPriceValue === 0) {
    return { ...preview, ...richFields, isFreeOrPwyw: true, priceSignal: 'zero_price_no_pwyw_tag' };
  }
  // Preço > 0 sem tag PWYW: sugestão omitida (null), nunca "pago" assumido
  // silenciosamente (requisito 3/4 da spec, D119).
  return { ...preview, ...richFields, isFreeOrPwyw: null, priceSignal: 'nonzero_price_no_pwyw_tag' };
}
