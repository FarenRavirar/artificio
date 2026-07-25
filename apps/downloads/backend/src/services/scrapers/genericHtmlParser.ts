// Spec 085 (emenda E1-E7, Fase 7) — substitui onebookshelfHtmlParser.ts:
// admin cola HTML de qualquer site cadastrado no registry
// (download_scraper_platform), sem escolher plataforma manualmente
// (elimina o bug P2 do review PR #200 na raiz — admin nao pode escolher
// errado porque nao escolhe). Fluxo: extrai canonical -> resolve hostname
// -> busca plataforma no registry por domain exato -> extracao padrao
// JSON-LD Schema.org (a maioria dos 100+ sites cadastraveis so precisa
// disso) -> override em codigo (T7.2) roda depois e so sobrescreve o que
// declara, pra peculiaridade de site (ex.: tag PWYW do OneBookShelf).

import { z } from 'zod';
import ipaddr from 'ipaddr.js';
import { sanitizeText } from '../sanitizeText';
import { applyPlatformOverride, type PlatformOverrideInput } from './platformOverrides';
import type { DownloadScraperPlatform } from '../../db/types';

// Achado real (review PR #201, Codex, P2): regex original exigia
// <script type="application/ld+json"> literal no início da tag e
// <link rel="canonical" href="..."> nessa ordem exata — HTML real de
// terceiros (não testado nos fixtures que temos) pode ter atributos extras
// antes (ex.: <script nonce="..." type="application/ld+json">) ou aspas
// simples. Como o objetivo desta spec é cadastrar site novo SEM código
// (parser_kind='json_ld_generic'), a extração não pode depender de ordem
// de atributos — só de type="application/ld+json" e rel="canonical"
// aparecerem em algum ponto da tag, aspas simples ou duplas.
const JSON_LD_BLOCK_RE = /<script\b[^>]*\btype\s*=\s*(["'])application\/ld\+json\1[^>]*>(.*?)<\/script>/gis;
const LINK_TAG_RE = /<link\b[^>]*>/gi;
const HREF_ATTR_RE = /\bhref\s*=\s*(["'])(.*?)\1/i;
const META_TAG_RE = /<meta\b[^>]*>/gi;
const CONTENT_ATTR_RE = /\bcontent\s*=\s*(["'])(.*?)\1/i;
const HTML_LANG_RE = /<html[^>]*\blang\s*=\s*(["'])(.*?)\1/i;

// Achado real (review PR #199, preservado): z.url() só valida sintaxe —
// HTML adulterado podia colar canonical/og:image com protocolo não-http(s)
// (ex.: ftp://) ou apontando pra host interno/privado/metadata cloud. Só
// http(s) público passa; nunca persistir URL fora desse contrato.
// Achado real (review PR #201, CodeRabbit): regex string matching não pega
// IPv4-mapped IPv6 (::ffff:127.0.0.1) nem fe80::/10 link-local. Troca por
// ipaddr.js: parse real do host (quando é IP literal) + range() cobre
// loopback/private/linkLocal/uniqueLocal/carrierGradeNat pros dois protocolos.
const LOCAL_HOSTNAME_RE = /^(localhost)$/i;

function isPrivateOrLocalIp(hostname: string): boolean {
  let addr: ReturnType<typeof ipaddr.process>;
  try {
    addr = ipaddr.process(hostname);
  } catch {
    return false;
  }
  const range = addr.range();
  return range !== 'unicast';
}

export function isPublicHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (LOCAL_HOSTNAME_RE.test(hostname)) return false;
  if (ipaddr.isValid(hostname) && isPrivateOrLocalIp(hostname)) return false;
  return true;
}

const publicHttpUrlSchema = z.string().refine(isPublicHttpUrl, {
  message: 'URL precisa ser http(s) pública (sem host local/privado/metadata).',
});

// Schema fechado (.strict()) — T1.5 (preservado): rejeita qualquer chave
// extra que o parser/override tente devolver além do shape esperado.
export const genericParsePreviewSchema = z
  .object({
    sourceUrl: publicHttpUrlSchema,
    title: z.string().min(1),
    description: z.string().nullable(),
    isFreeOrPwyw: z.boolean().nullable(),
    coverImageUrl: publicHttpUrlSchema.nullable(),
    publisherName: z.string().nullable(),
    sourceLanguageHint: z.enum(['pt', 'not_pt']).nullable(),
    extractedPriceValue: z.number().nullable(),
    priceSignal: z.enum(['pwyw_tag_present', 'zero_price_no_pwyw_tag', 'nonzero_price_no_pwyw_tag']),
  })
  .strict();

export type GenericParsePreview = z.infer<typeof genericParsePreviewSchema>;

export type GenericParseErrorCode =
  | 'html_too_large'
  | 'missing_json_ld'
  | 'invalid_json_ld'
  | 'missing_canonical'
  | 'unsupported_platform'
  | 'invalid_url';

export class GenericParseError extends Error {
  constructor(
    public readonly code: GenericParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GenericParseError';
  }
}

export const MAX_HTML_LENGTH = 1_000_000; // maior fixture real: 158KB, folga ampla

interface GenericJsonLd {
  '@type'?: string | string[];
  '@graph'?: unknown[];
  name?: string;
  description?: string;
  brand?: { name?: string };
  offers?: { price?: number | string } | { price?: number | string }[];
}

function hasProductType(node: GenericJsonLd): boolean {
  const type = node['@type'];
  return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
}

// Achado real (review PR #201, Codex, P1): JSON-LD raiz nem sempre é um
// objeto Product isolado — sites podem envolver em @graph (grupo de
// entidades), array no topo (vários objetos no mesmo bloco <script>), ou
// declarar @type como array (["Product", "Thing"]). Normaliza cada bloco
// candidato pra uma lista plana de nós antes de procurar Product, em vez
// de assumir objeto raiz único.
function flattenJsonLdCandidates(parsedBlock: unknown): GenericJsonLd[] {
  if (Array.isArray(parsedBlock)) {
    return parsedBlock.flatMap((item) => flattenJsonLdCandidates(item));
  }
  if (parsedBlock && typeof parsedBlock === 'object') {
    const node = parsedBlock as GenericJsonLd;
    const graph = Array.isArray(node['@graph']) ? node['@graph'].flatMap((item) => flattenJsonLdCandidates(item)) : [];
    return [node, ...graph];
  }
  return [];
}

// Achado real (review PR #199, preservado): página pode conter JSON-LD de
// organização/breadcrumb antes do bloco de produto; pegar só o primeiro
// bloco (regex sem /g) devolvia name/description de entidade errada.
// Percorre todos os blocos (e seus nós aninhados via @graph/array) e usa o
// primeiro cujo @type seja/contenha "Product".
function extractJsonLd(html: string): GenericJsonLd {
  const blocks = html.matchAll(JSON_LD_BLOCK_RE);
  let sawAnyBlock = false;
  let sawValidJson = false;
  for (const block of blocks) {
    sawAnyBlock = true;
    let parsedBlock: unknown;
    try {
      parsedBlock = JSON.parse(block[2]);
    } catch {
      continue;
    }
    sawValidJson = true;
    const product = flattenJsonLdCandidates(parsedBlock).find(hasProductType);
    if (product) return product;
  }
  if (!sawAnyBlock) {
    throw new GenericParseError('missing_json_ld', 'HTML não contém bloco <script type="application/ld+json">.');
  }
  if (!sawValidJson) {
    throw new GenericParseError('invalid_json_ld', 'Bloco JSON-LD presente mas não é JSON válido.');
  }
  throw new GenericParseError('invalid_json_ld', 'Nenhum bloco JSON-LD com @type "Product" encontrado.');
}

// Sinal padrão sem override: preço 0 -> gratuito; preço > 0 -> sugestão
// omitida (null), nunca "pago" assumido silenciosamente (mesma trava do
// requisito 3/4 da spec — só um override que conhece a peculiaridade do
// site, como a tag PWYW do OneBookShelf, pode confirmar PWYW).
function resolveDefaultPriceSignal(price: number | null): {
  isFreeOrPwyw: boolean | null;
  priceSignal: GenericParsePreview['priceSignal'];
} {
  if (price === 0) {
    return { isFreeOrPwyw: true, priceSignal: 'zero_price_no_pwyw_tag' };
  }
  return { isFreeOrPwyw: null, priceSignal: 'nonzero_price_no_pwyw_tag' };
}

// Busca plataforma no registry por hostname do canonical. SEMPRE
// "WHERE domain = $1" (nunca fallback pra linha domain=NULL) — passado via
// callback pra manter este módulo sem dependência direta de `db`/kysely
// (facilita teste unitário do parser com fixture, sem mockar banco).
export type FindPlatformByDomain = (domain: string) => Promise<DownloadScraperPlatform | null>;

// Achado real (review PR #201, Codex, P2): extrai a tag inteira primeiro
// (<link ...>/<meta ...>), depois procura rel="canonical"/property="og:image"
// e href/content dentro dela, independente de ordem entre os atributos —
// site cadastrado via parser_kind='json_ld_generic' não deve exigir que o
// HTML siga uma ordem de atributos específica.
function findCanonicalUrl(html: string): string | null {
  for (const tagMatch of html.matchAll(LINK_TAG_RE)) {
    const tag = tagMatch[0];
    if (!/\brel\s*=\s*(["'])canonical\1/i.test(tag)) continue;
    const href = HREF_ATTR_RE.exec(tag);
    if (href) return href[2];
  }
  return null;
}

function findOgImageUrl(html: string): string | null {
  for (const tagMatch of html.matchAll(META_TAG_RE)) {
    const tag = tagMatch[0];
    if (!/\bproperty\s*=\s*(["'])og:image\1/i.test(tag)) continue;
    const content = CONTENT_ATTR_RE.exec(tag);
    if (content) return content[2];
  }
  return null;
}

// Achado real (review PR #201, Sonar): ternário aninhado — extraído em
// função nomeada só pra deixar a intenção explícita (pt / not_pt / null).
function resolveSourceLanguageHint(langMatch: RegExpExecArray | null): 'pt' | 'not_pt' | null {
  if (!langMatch) return null;
  return langMatch[2]?.toLowerCase().startsWith('pt') ? 'pt' : 'not_pt';
}

// Achado real (review PR #201, Sonar): ternário aninhado — extraído em
// função nomeada, mesma regra de aceitar Number ou Text do Schema.org
// (achado review PR #199, preservado): só aceita se for número finito.
function extractPriceValue(rawPrice: number | string | undefined): number | null {
  if (typeof rawPrice === 'number') {
    return Number.isFinite(rawPrice) ? rawPrice : null;
  }
  if (typeof rawPrice === 'string' && rawPrice.trim() !== '' && Number.isFinite(Number(rawPrice))) {
    return Number(rawPrice);
  }
  return null;
}

export async function parseHtml(html: string, findPlatformByDomain: FindPlatformByDomain): Promise<GenericParsePreview> {
  if (html.length > MAX_HTML_LENGTH) {
    throw new GenericParseError('html_too_large', `HTML maior que o limite de ${MAX_HTML_LENGTH} bytes.`);
  }

  const sourceUrl = findCanonicalUrl(html);
  if (!sourceUrl) {
    throw new GenericParseError('missing_canonical', 'HTML não contém <link rel="canonical">.');
  }

  if (!isPublicHttpUrl(sourceUrl)) {
    throw new GenericParseError('invalid_url', `Canonical não é uma URL http(s) pública: ${sourceUrl}`);
  }

  const canonicalHost = new URL(sourceUrl).hostname;
  const platform = await findPlatformByDomain(canonicalHost);
  if (!platform) {
    throw new GenericParseError(
      'unsupported_platform',
      `Domínio "${canonicalHost}" não está cadastrado no registry de plataformas. Cadastre em /gestao/plataformas antes de importar.`,
    );
  }

  const jsonLd = extractJsonLd(html);
  if (!jsonLd.name) {
    throw new GenericParseError('invalid_json_ld', 'JSON-LD não contém campo "name".');
  }

  const rawCoverImageUrl = findOgImageUrl(html);
  const coverImageUrl = rawCoverImageUrl && isPublicHttpUrl(rawCoverImageUrl) ? rawCoverImageUrl : null;
  const langMatch = HTML_LANG_RE.exec(html);
  const sourceLanguageHint = resolveSourceLanguageHint(langMatch);

  // Schema.org offers.price aceita Number ou Text (achado review PR #199,
  // preservado): sites podem emitir string numérica ("4.00"); só rejeita
  // se não for um número finito de fato.
  // Achado real (review PR #201, Codex, P1): offers também pode ser array
  // (múltiplas ofertas/variações) — usa o preço da primeira oferta válida.
  const firstOffer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
  const extractedPriceValue = extractPriceValue(firstOffer?.price);

  const defaultSignal = resolveDefaultPriceSignal(extractedPriceValue);

  const basePreview: PlatformOverrideInput = {
    sourceUrl,
    title: jsonLd.name,
    description: jsonLd.description ? sanitizeText(jsonLd.description) : null,
    isFreeOrPwyw: defaultSignal.isFreeOrPwyw,
    coverImageUrl,
    publisherName: jsonLd.brand?.name ?? null,
    sourceLanguageHint,
    extractedPriceValue,
    priceSignal: defaultSignal.priceSignal,
  };

  // T7.2 — override em código roda por último, só sobrescreve o que
  // declara (ex.: onebookshelf sobrescreve isFreeOrPwyw/priceSignal via
  // tag PWYW; nunca reimplementa title/description/publisher/image).
  const finalPreview = applyPlatformOverride(platform.parser_kind, basePreview, html);

  return genericParsePreviewSchema.parse(finalPreview);
}
