// Spec 085 — parser determinístico (sem IA) de HTML colado manualmente pelo
// admin, produtos DMs Guild/DriveThruRPG (WAF bloqueia scraper automático,
// spec 084). Mesmo padrão de itchIoParser.ts: regex ancorada em bloco/tag
// isolado, sem lib DOM — confirmado suficiente contra os 3 fixtures reais
// (JSON-LD Schema.org idêntico nas 3 marcas OneBookShelf).

import { z } from 'zod';

const JSON_LD_BLOCK_RE = /<script type="application\/ld\+json">(.*?)<\/script>/s;
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

// Schema fechado (.strict()) — T1.5: rejeita qualquer chave extra que o
// parser tente devolver além do shape esperado (achado real: sem isso, um
// campo acidental do JSON-LD/regex vazaria pro preview sem detecção).
export const oneBookShelfParsePreviewSchema = z
  .object({
    sourceUrl: z.url(),
    title: z.string().min(1),
    description: z.string().nullable(),
    isFreeOrPwyw: z.boolean().nullable(),
    coverImageUrl: z.url().nullable(),
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
  | 'domain_mismatch';

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
  name?: string;
  description?: string;
  brand?: { name?: string };
  offers?: { price?: number };
}

function extractJsonLd(html: string): OneBookShelfJsonLd {
  const match = JSON_LD_BLOCK_RE.exec(html);
  if (!match) {
    throw new OneBookShelfParseError('missing_json_ld', 'HTML não contém bloco <script type="application/ld+json">.');
  }
  try {
    return JSON.parse(match[1]) as OneBookShelfJsonLd;
  } catch {
    throw new OneBookShelfParseError('invalid_json_ld', 'Bloco JSON-LD presente mas não é JSON válido.');
  }
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

  const expectedDomain = SOURCE_DOMAIN[sourcePlatform];
  let canonicalHost: string;
  try {
    canonicalHost = new URL(sourceUrl).hostname;
  } catch {
    throw new OneBookShelfParseError('domain_mismatch', `Canonical não é uma URL válida: ${sourceUrl}`);
  }
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
  const coverImageUrl = coverImageMatch?.[1] ?? coverImageMatch?.[2] ?? null;
  const langMatch = HTML_LANG_RE.exec(html);
  const sourceLanguageHint = langMatch?.[1]?.toLowerCase().startsWith('pt') ? 'pt' : langMatch ? 'not_pt' : null;

  const extractedPriceValue = typeof jsonLd.offers?.price === 'number' ? jsonLd.offers.price : null;
  const { isFreeOrPwyw, priceSignal } = resolvePriceSignal(html, extractedPriceValue);

  const preview = {
    sourceUrl,
    title: jsonLd.name,
    description: jsonLd.description ?? null,
    isFreeOrPwyw,
    coverImageUrl,
    publisherName: jsonLd.brand?.name ?? null,
    sourceLanguageHint,
    extractedPriceValue,
    priceSignal,
  } satisfies OneBookShelfParsePreview;

  return oneBookShelfParsePreviewSchema.parse(preview);
}
