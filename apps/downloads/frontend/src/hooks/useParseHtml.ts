import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { apiPost } from '../services/apiClient';

const priceSignalSchema = z.enum(['pwyw_tag_present', 'zero_price_no_pwyw_tag', 'nonzero_price_no_pwyw_tag']);
export type ParsePriceSignal = z.infer<typeof priceSignalSchema>;

export const parsePreviewSchema = z.object({
  sourceUrl: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isFreeOrPwyw: z.boolean().nullable(),
  coverImageUrl: z.string().nullable(),
  publisherName: z.string().nullable(),
  sourceLanguageEvidence: z.enum(['pt', 'not_pt']).nullable(),
  extractedPriceValue: z.number().nullable(),
  priceSignal: priceSignalSchema,
});
export type ParsePreview = z.infer<typeof parsePreviewSchema>;

const duplicateCandidateSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  similarity: z.number(),
});
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;

const detectedPlatformSchema = z.object({
  slug: z.string(),
  name: z.string(),
});
export type DetectedPlatform = z.infer<typeof detectedPlatformSchema>;

const parseHtmlResponseSchema = z.object({
  preview: parsePreviewSchema,
  duplicateCandidates: z.array(duplicateCandidateSchema),
  parse_case_id: z.string(),
  detectedPlatform: detectedPlatformSchema,
});
export type ParseHtmlResponse = z.infer<typeof parseHtmlResponseSchema>;

export interface ParseHtmlPayload {
  html: string;
}

// T8.3 (spec 085, Fase 8) — renomeado de useParseOneBookShelfHtml: chama
// POST /parse-html (T7.3), payload passa a ser só { html } — plataforma
// não é mais escolhida pelo admin, é DETECTADA pelo canonical do HTML
// (elimina o bug P2 do review PR #200 na raiz). Resposta ganha
// detectedPlatform (slug+name), consumido pelo /ingest depois.
export function useParseHtml() {
  return useMutation({
    mutationFn: async (payload: ParseHtmlPayload): Promise<ParseHtmlResponse> => {
      const response = await apiPost('/api/v1/admin/scraper/parse-html', payload);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao analisar HTML: HTTP ${response.status}`);
      }
      return parseHtmlResponseSchema.parse(await response.json());
    },
  });
}
