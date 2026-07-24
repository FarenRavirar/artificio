// Spec 085 — parser determinístico (sem IA) de HTML colado manualmente pelo
// admin, produtos DMs Guild/DriveThruRPG (WAF bloqueia scraper automático,
// spec 084). Mesmo padrão de itchIoParser.ts: regex ancorada em bloco/tag
// isolado, sem lib DOM — confirmado suficiente contra os 3 fixtures reais
// (JSON-LD Schema.org idêntico nas 3 marcas OneBookShelf).

import { z } from 'zod';
import { sanitizeText } from '../sanitizeText';

const JSON_LD_BLOCK_RE = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
const CANONICAL_RE = /<link rel="canonical" href="([^"]+)"/;
const OG_IMAGE_RE = /property="og:image" content="([^"]+)"|content="([^"]+)" property="og:image"/;
const HTML_LANG_RE = /<html[^>]*\blang="([^"]+)"/;
const PWYW_TAG_MARKER = 'obs-product-format-pwyw-options';

const SOURCE_DOMAIN: Record<'dms_guild' | 'drivethrurpg', string> = {
  dms_guild: 'dmsguild.com',
  drivethrurpg: 'drivethrurpg.com',
};

export type OneBookShelfPriceSignal =
  | 'pwyw_tag_present'
  | 'zero_price_no_pwyw_tag'
  | 'nonzero_price_no_pwyw_tag';

// Achado real (review PR #199): z.url() só valida sintaxe — HTML adulterado
// podia colar canonical/og:image com protocolo não-http(s) (ex.: ftp://) ou
// apontando pra host interno/privado/metadata cloud. Só http(s) público
// passa; nunca persistir URL fora desse contrato.
const LOCAL_OR_PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|\[::1\]$|\[fc|\[fd)/i;

function isPublicHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (LOCAL_OR_PRIVATE_HOST_RE.test(parsed.hostname)) return false;
  return true;
}

const publicHttpUrlSchema = z.string().refine(isPublicHttpUrl, {
  message: 'URL precisa ser http(s) pública (sem host local/privado/metadata).',
});

// Schema fechado (.strict()) — T1.5: rejeita qualquer chave extra que o
// parser tente devolver além do shape esperado (achado real: sem isso, um
// campo acidental do JSON-LD/regex vazaria pro preview sem detecção).
export const oneBookShelfParsePreviewSchema = z
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

export type OneBookShelfParsePreview = z.infer<typeof oneBookShelfParsePreviewSchema>;

export type OneBookShelfParseErrorCode =
  | 'html_too_large'
  | 'missing_json_ld'
  | 'invalid_json_ld'
  | 'missing_canonical'
  | 'domain_mismatch'
  | 'invalid_url';

export class OneBookShelfParseError extends Error {
  constructor(
    public readonly code: OneBookShelfParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OneBookShelfParseError';
  }
}

// Achado real (T0/T0.2b): domínio do canonical precisa bater exatamente com
// o source_platform declarado — JSON-LD é idêntico entre DMs Guild,
// DriveThruRPG e marcas irmãs (StorytellersVault), só o canonical distingue.
export const MAX_HTML_LENGTH = 1_000_000; // maior fixture real: 158KB, folga ampla

interface OneBookShelfJsonLd {
  '@type'?: string;
  name?: string;
  description?: string;
  brand?: { name?: string };
  offers?: { price?: number | string };
}

// Achado real (review PR #199): página pode conter JSON-LD de
// organização/breadcrumb antes do bloco de produto; pegar só o primeiro
// bloco (regex sem /g) devolvia name/description de entidade errada.
// Percorre todos os blocos e usa o primeiro cujo @type seja "Product".
function extractJsonLd(html: string): OneBookShelfJsonLd {
  const blocks = html.matchAll(JSON_LD_BLOCK_RE);
  let sawAnyBlock = false;
  let sawValidJson = false;
  for (const block of blocks) {
    sawAnyBlock = true;
    let parsed: OneBookShelfJsonLd;
    try {
      parsed = JSON.parse(block[1]) as OneBookShelfJsonLd;
    } catch {
      continue;
    }
    sawValidJson = true;
    if (parsed['@type'] === 'Product') return parsed;
  }
  if (!sawAnyBlock) {
    throw new OneBookShelfParseError('missing_json_ld', 'HTML não contém bloco <script type="application/ld+json">.');
  }
  if (!sawValidJson) {
    throw new OneBookShelfParseError('invalid_json_ld', 'Bloco JSON-LD presente mas não é JSON válido.');
  }
  throw new OneBookShelfParseError('invalid_json_ld', 'Nenhum bloco JSON-LD com @type "Product" encontrado.');
}

function resolvePriceSignal(html: string, price: number | null): { isFreeOrPwyw: boolean | null; priceSignal: OneBookShelfPriceSignal } {
  if (html.includes(PWYW_TAG_MARKER)) {
    return { isFreeOrPwyw: true, priceSignal: 'pwyw_tag_present' };
  }
  if (price === 0) {
    return { isFreeOrPwyw: true, priceSignal: 'zero_price_no_pwyw_tag' };
  }
  // Preço > 0 sem tag PWYW: fora do critério D119 (gratuito/PWYW) —
  // sugestão omitida (null), não `false` silencioso (ver requisito 3/4 spec).
  return { isFreeOrPwyw: null, priceSignal: 'nonzero_price_no_pwyw_tag' };
}

export function parseOneBookShelfHtml(
  html: string,
  sourcePlatform: 'dms_guild' | 'drivethrurpg',
): OneBookShelfParsePreview {
  if (html.length > MAX_HTML_LENGTH) {
    throw new OneBookShelfParseError('html_too_large', `HTML maior que o limite de ${MAX_HTML_LENGTH} bytes.`);
  }

  const canonicalMatch = CANONICAL_RE.exec(html);
  if (!canonicalMatch) {
    throw new OneBookShelfParseError('missing_canonical', 'HTML não contém <link rel="canonical">.');
  }
  const sourceUrl = canonicalMatch[1];

  if (!isPublicHttpUrl(sourceUrl)) {
    throw new OneBookShelfParseError('invalid_url', `Canonical não é uma URL http(s) pública: ${sourceUrl}`);
  }
  const expectedDomain = SOURCE_DOMAIN[sourcePlatform];
  const canonicalHost = new URL(sourceUrl).hostname;
  if (canonicalHost !== expectedDomain && !canonicalHost.endsWith(`.${expectedDomain}`)) {
    throw new OneBookShelfParseError(
      'domain_mismatch',
      `Domínio do canonical (${canonicalHost}) não corresponde a source_platform "${sourcePlatform}" (esperado ${expectedDomain}).`,
    );
  }

  const jsonLd = extractJsonLd(html);
  if (!jsonLd.name) {
    throw new OneBookShelfParseError('invalid_json_ld', 'JSON-LD não contém campo "name".');
  }

  const coverImageMatch = OG_IMAGE_RE.exec(html);
  const rawCoverImageUrl = coverImageMatch?.[1] ?? coverImageMatch?.[2] ?? null;
  const coverImageUrl = rawCoverImageUrl && isPublicHttpUrl(rawCoverImageUrl) ? rawCoverImageUrl : null;
  const langMatch = HTML_LANG_RE.exec(html);
  const sourceLanguageHint = langMatch?.[1]?.toLowerCase().startsWith('pt') ? 'pt' : langMatch ? 'not_pt' : null;

  // Schema.org offers.price aceita Number ou Text (achado review PR #199):
  // OneBookShelf pode emitir string numérica ("4.00"); só rejeita se não for
  // um número finito de fato.
  const rawPrice = jsonLd.offers?.price;
  const extractedPriceValue =
    typeof rawPrice === 'number'
      ? Number.isFinite(rawPrice)
        ? rawPrice
        : null
      : typeof rawPrice === 'string' && rawPrice.trim() !== '' && Number.isFinite(Number(rawPrice))
        ? Number(rawPrice)
        : null;
  const { isFreeOrPwyw, priceSignal } = resolvePriceSignal(html, extractedPriceValue);

  const preview = {
    sourceUrl,
    title: jsonLd.name,
    description: jsonLd.description ? sanitizeText(jsonLd.description) : null,
    isFreeOrPwyw,
    coverImageUrl,
    publisherName: jsonLd.brand?.name ?? null,
    sourceLanguageHint,
    extractedPriceValue,
    priceSignal,
  } satisfies OneBookShelfParsePreview;

  return oneBookShelfParsePreviewSchema.parse(preview);
}
