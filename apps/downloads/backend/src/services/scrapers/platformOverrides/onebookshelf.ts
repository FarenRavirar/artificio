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
// Spec 088 (T2.3c) — os facets vêm no idioma da loja, e a mesma família
// OneBookShelf serve páginas em pt e en: DMs Guild usa `tipoDeProduto`/
// `edicao`/`tema`, DriveThruRPG usa `genre`/`productType`. Com só os nomes
// em português aqui, `tags` e `sourceFilters` saíam VAZIOS em toda página
// em inglês — silenciosamente, porque a linha `filters` existe e é
// encontrada; só nenhum href dela casava. Confirmado em DOM real das duas
// lojas (2026-07-26): DriveThruRPG entrega `?genre=300-modern` e
// `?productType=2140-core-rulebooks`; DMs Guild entrega `?tipoDeProduto=`,
// `?tema=` e `?edicao=`. `tema` também faltava no conjunto original.
const FILTER_FACETS = new Set([
  // pt (DMs Guild, DriveThruRPG/pt, StorytellersVault/pt)
  'tipoDeProduto', 'edicao', 'cenario', 'conteudo', 'tema',
  // en (mesmas lojas servidas em inglês)
  'productType', 'edition', 'setting', 'content', 'genre',
]);
type Anchor = { href: string; content: string };
type SourceFilterEntry = { facet: string; text: string };

function normalizedText(html: string): string {
  return sanitizeText(html.replace(/<br\b[^>]*>/gi, ' ')).replace(/\s+/g, ' ').trim();
}

// Spec 088 (T2.3c) — a loja escreve "N/A" (en) ou "N / D" (pt) quando o
// campo não tem valor, em vez de omitir a linha. Preservar isso como texto
// fazia a ficha exibir "N / D" no lugar do nome do artista, como se fosse
// crédito real — afirmação falsa sobre a obra, exatamente o que o requisito
// 38 proíbe. Ausência tem que virar `null` explícito, que é o que os
// consumidores já tratam. Espaçamento variável ("N/D", "N / D", "n.a.") é
// normalizado antes da comparação; texto que apenas COMEÇA com isso (ex.
// "N/A Studios", nome real de editora) nunca casa, porque a âncora exige a
// string inteira.
const NOT_AVAILABLE_VALUES = new Set(['na', 'nd', 'n/a', 'n/d', 'n.a.', 'n.d.']);

function isNotAvailable(value: string): boolean {
  return NOT_AVAILABLE_VALUES.has(value.toLowerCase().replace(/\s+/g, ''));
}

function nullableText(html: string | undefined): string | null {
  const value = html ? normalizedText(html) : '';
  if (value === '' || isNotAvailable(value)) return null;
  return value;
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
function isAnchorStart(html: string, start: number): boolean {
  const nextCharacter = html[start + 2];
  return nextCharacter === '>' || /\s/.test(nextCharacter ?? '');
}

function findTagEnd(html: string, start: number): number {
  let quote: string | null = null;
  for (let index = start + 2; index < html.length; index += 1) {
    const character = html[index];
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

function extractAnchors(html: string): Anchor[] {
  const anchors: Anchor[] = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const openStart = lowerHtml.indexOf('<a', cursor);
    if (openStart === -1) break;
    if (!isAnchorStart(lowerHtml, openStart)) {
      cursor = openStart + 2;
      continue;
    }
    const openEnd = findTagEnd(html, openStart);
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

function toSourceFilterEntry(anchor: Anchor): SourceFilterEntry | null {
  const text = nullableText(anchor.content);
  if (!text) return null;
  try {
    const url = new URL(anchor.href, 'https://onebookshelf.invalid');
    const facet = [...url.searchParams.keys()].find((key) => FILTER_FACETS.has(key));
    return facet ? { facet, text } : null;
  } catch {
    // HTML externo malformado não pode abortar a extração dos demais filtros.
    return null;
  }
}

function extractListSourceFilters(listHtml: string): SourceFilter[] {
  const filters: SourceFilter[] = [];
  let current: SourceFilter | null = null;
  for (const anchor of extractAnchors(listHtml)) {
    const entry = toSourceFilterEntry(anchor);
    if (!entry) continue;
    if (!current || current.facet !== entry.facet) {
      current = { facet: entry.facet, path: [] };
      filters.push(current);
    }
    current.path.push(entry.text);
  }
  return filters;
}

function extractSourceFilters(filtersHtml: string | undefined): SourceFilter[] {
  if (!filtersHtml) return [];
  return [...filtersHtml.matchAll(LI_RE)].flatMap((listItem) => extractListSourceFilters(listItem[1]));
}

function flattenFilterTags(sourceFilters: SourceFilter[]): string[] {
  return [...new Set(sourceFilters.flatMap(({ path }) => path))];
}

// Spec 088 (T2.9c, requisito 51) — o tipo de material que a loja de fato
// declara vive no facet `tipoDeProduto` (pt) / `productType` (en) da linha de
// filtros, e NAO em texto livre. Ex. real: "Regras basicas", "Opcoes para
// personagens", "Core Rulebooks".
//
// Usa a folha (ultimo elemento do caminho), nao a raiz: o facet e hierarquico
// ("Opcoes para personagens" > "Classe/Arquetipo") e a folha e o termo mais
// especifico que a loja atribuiu. Quando o facet nao aparece, retorna `null`
// explicito — nunca derivar tipo de titulo ou descricao (requisito 56).
const MATERIAL_TYPE_FACETS = new Set(['tipoDeProduto', 'productType']);

function extractMaterialTypeHint(sourceFilters: SourceFilter[]): string | null {
  const typeFilter = sourceFilters.find(({ facet }) => MATERIAL_TYPE_FACETS.has(facet));
  return typeFilter?.path.at(-1) ?? null;
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
    // Spec 088 (T2.3c) — o valor tem que vir de um parágrafo DIFERENTE do
    // rótulo. Desde que `nullableText` passou a anular "N / D", um tile cujo
    // valor é ausente colapsa para um único parágrafo (só o rótulo), e
    // `paragraphs.at(-1)` devolveria o próprio rótulo como se fosse o valor
    // — gravando "Categoria" no lugar da categoria. Exigir 2+ posições
    // mantém o tile vazio corretamente ausente.
    const value = paragraphs.length > 1 ? paragraphs.at(-1) : undefined;
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
  const richFields: Pick<PlatformOverrideInput, 'systemHint' | 'materialTypeHint' | 'authorsCredits' | 'artistsCredits' | 'creationMethod' | 'sourceFilters' | 'tags' | 'fileSizeText' | 'format' | 'pageCount' | 'sourceCategory' | 'descriptionHtml' | 'description'> = {
    // Achado real (spec 086, Fase 4): data-codeid="ruleSystem" (label real
    // do site: "Universo de jogo") e o SISTEMA/regra do material (ex.
    // "Vampire the Masquerade", "D&D 5e") — antes desta correcao ia pro
    // campo 'scenario', que na verdade nunca teve extrator proprio.
    // Correcao de comentario (review PR #204, Codex): 'scenario' NAO e
    // zerado aqui — nem entra no Pick<> de richFields, entao continua
    // herdado de preview.scenario via spread no return. A tabela de
    // detalhes do OneBookShelf so nao tem campo separado pra cenario de
    // ambientacao (por isso nenhum extrator dedicado foi escrito pra ele).
    systemHint: nullableText(details.get('ruleSystem')),
    materialTypeHint: extractMaterialTypeHint(sourceFilters),
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
