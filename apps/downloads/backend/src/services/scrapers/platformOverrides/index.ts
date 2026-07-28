// Spec 085 (D-C, Fase 7, T7.2) — registry de overrides EM CÓDIGO, chave é o
// slug guardado em download_scraper_platform.parser_kind (nunca caminho de
// arquivo/módulo — banco não referencia estrutura de diretório). Override
// roda depois da extração JSON-LD padrão (genericHtmlParser.ts) e só
// sobrescreve os campos que declara — peculiaridade de site sempre vira
// código, nunca configurável na UI (E1-E7).

import { applyOneBookShelfOverride } from './onebookshelf';
import type { SourceFilter } from '../types';

export interface PlatformOverrideInput {
  sourceUrl: string;
  title: string;
  description: string | null;
  isFreeOrPwyw: boolean | null;
  coverImageUrl: string | null;
  publisherName: string | null;
  sourceLanguageEvidence: 'pt' | 'not_pt' | null;
  extractedPriceValue: number | null;
  priceSignal: 'pwyw_tag_present' | 'zero_price_no_pwyw_tag' | 'nonzero_price_no_pwyw_tag';
  scenario?: string | null;
  // Achado real (spec 086, Fase 4) — ver mesmo comentario em services/scrapers/types.ts.
  systemHint?: string | null;
  // Spec 088 (T2.9b) — ver mesmo comentário em services/scrapers/types.ts.
  materialTypeHint?: string | null;
  authorsCredits?: string | null;
  artistsCredits?: string | null;
  creationMethod?: string | null;
  sourceFilters?: SourceFilter[];
  tags?: string[];
  fileSizeText?: string | null;
  format?: string | null;
  pageCount?: number | null;
  sourceCategory?: string | null;
  descriptionHtml?: string | null;
}

type OverrideFn = (preview: PlatformOverrideInput, html: string) => PlatformOverrideInput;

// 'json_ld_generic' (default do registry) não entra neste mapa — plataforma
// sem override não passa por transformação nenhuma, fica só com o resultado
// da extração padrão.
const OVERRIDES: Record<string, OverrideFn> = {
  onebookshelf: applyOneBookShelfOverride,
};

export const KNOWN_PARSER_KINDS = ['json_ld_generic', ...Object.keys(OVERRIDES)] as const;

export function applyPlatformOverride(parserKind: string, preview: PlatformOverrideInput, html: string): PlatformOverrideInput {
  const override = OVERRIDES[parserKind];
  if (!override) return preview;
  return override(preview, html);
}
