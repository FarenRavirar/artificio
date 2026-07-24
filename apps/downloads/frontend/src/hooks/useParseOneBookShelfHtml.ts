import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { apiPost } from '../services/apiClient';

export const oneBookShelfSourcePlatformSchema = z.enum(['dms_guild', 'drivethrurpg']);
export type OneBookShelfSourcePlatform = z.infer<typeof oneBookShelfSourcePlatformSchema>;

const priceSignalSchema = z.enum(['pwyw_tag_present', 'zero_price_no_pwyw_tag', 'nonzero_price_no_pwyw_tag']);
export type OneBookShelfPriceSignal = z.infer<typeof priceSignalSchema>;

export const oneBookShelfPreviewSchema = z.object({
  sourceUrl: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isFreeOrPwyw: z.boolean().nullable(),
  coverImageUrl: z.string().nullable(),
  publisherName: z.string().nullable(),
  sourceLanguageHint: z.enum(['pt', 'not_pt']).nullable(),
  extractedPriceValue: z.number().nullable(),
  priceSignal: priceSignalSchema,
});
export type OneBookShelfPreview = z.infer<typeof oneBookShelfPreviewSchema>;

const duplicateCandidateSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  similarity: z.number(),
});
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;

const parseHtmlResponseSchema = z.object({
  preview: oneBookShelfPreviewSchema,
  duplicateCandidates: z.array(duplicateCandidateSchema),
  parse_case_id: z.string(),
});
export type ParseHtmlResponse = z.infer<typeof parseHtmlResponseSchema>;

export interface ParseHtmlPayload {
  source_platform: OneBookShelfSourcePlatform;
  html: string;
}

// T5.1 (spec 085) — chama POST /parse-html (Fase 2), sem persistencia:
// devolve preview + candidatos de duplicata (Fase 3) + parse_case_id
// (Fase 4, linkado no /ingest depois via T5.2).
export function useParseOneBookShelfHtml() {
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
