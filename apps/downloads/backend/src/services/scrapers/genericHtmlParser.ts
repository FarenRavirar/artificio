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
import { sanitizeText } from '../sanitizeText';
import { applyPlatformOverride, type PlatformOverrideInput } from './platformOverrides';
import type { DownloadScraperPlatform } from '../../db/types';

const JSON_LD_BLOCK_RE = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
const CANONICAL_RE = /<link rel="canonical" href="([^"]+)"/;
const OG_IMAGE_RE = /property="og:image" content="([^"]+)"|content="([^"]+)" property="og:image"/;
const HTML_LANG_RE = /<html[^>]*\blang="([^"]+)"/;

// Achado real (review PR #199, preservado): z.url() só valida sintaxe —
// HTML adulterado podia colar canonical/og:image com protocolo não-http(s)
// (ex.: ftp://) ou apontando pra host interno/privado/metadata cloud. Só
// http(s) público passa; nunca persistir URL fora desse contrato.
const LOCAL_OR_PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|\[::1\]$|\[fc|\[fd)/i;

export function isPublicHttpUrl(value: string): boolean {
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
  '@type'?: string;
  name?: string;
  description?: string;
  brand?: { name?: string };
  offers?: { price?: number | string };
}

// Achado real (review PR #199, preservado): página pode conter JSON-LD de
// organização/breadcrumb antes do bloco de produto; pegar só o primeiro
// bloco (regex sem /g) devolvia name/description de entidade errada.
// Percorre todos os blocos e usa o primeiro cujo @type seja "Product".
function extractJsonLd(html: string): GenericJsonLd {
  const blocks = html.matchAll(JSON_LD_BLOCK_RE);
  let sawAnyBlock = false;
  let sawValidJson = false;
  for (const block of blocks) {
    sawAnyBlock = true;
    let parsed: GenericJsonLd;
    try {
      parsed = JSON.parse(block[1]) as GenericJsonLd;
    } catch {
      continue;
    }
    sawValidJson = true;
    if (parsed['@type'] === 'Product') return parsed;
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

export async function parseHtml(html: string, findPlatformByDomain: FindPlatformByDomain): Promise<GenericParsePreview> {
  if (html.length > MAX_HTML_LENGTH) {
    throw new GenericParseError('html_too_large', `HTML maior que o limite de ${MAX_HTML_LENGTH} bytes.`);
  }

  const canonicalMatch = CANONICAL_RE.exec(html);
  if (!canonicalMatch) {
    throw new GenericParseError('missing_canonical', 'HTML não contém <link rel="canonical">.');
  }
  const sourceUrl = canonicalMatch[1];

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

  const coverImageMatch = OG_IMAGE_RE.exec(html);
  const rawCoverImageUrl = coverImageMatch?.[1] ?? coverImageMatch?.[2] ?? null;
  const coverImageUrl = rawCoverImageUrl && isPublicHttpUrl(rawCoverImageUrl) ? rawCoverImageUrl : null;
  const langMatch = HTML_LANG_RE.exec(html);
  const sourceLanguageHint = langMatch?.[1]?.toLowerCase().startsWith('pt') ? 'pt' : langMatch ? 'not_pt' : null;

  // Schema.org offers.price aceita Number ou Text (achado review PR #199,
  // preservado): sites podem emitir string numérica ("4.00"); só rejeita
  // se não for um número finito de fato.
  const rawPrice = jsonLd.offers?.price;
  const extractedPriceValue =
    typeof rawPrice === 'number'
      ? Number.isFinite(rawPrice)
        ? rawPrice
        : null
      : typeof rawPrice === 'string' && rawPrice.trim() !== '' && Number.isFinite(Number(rawPrice))
        ? Number(rawPrice)
        : null;

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
