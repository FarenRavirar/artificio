import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiPost } from '../services/apiClient';
import type { OneBookShelfSourcePlatform } from './useParseOneBookShelfHtml';

export interface IngestItemPayload {
  sourceUrl: string;
  title: string;
  description: string | null;
  isFreeOrPwyw: boolean;
  coverImageUrl: string | null;
  publisherName: string | null;
  sourceLanguageHint: 'pt' | 'not_pt' | null;
  parse_case_id?: string;
}

export interface IngestPayload {
  source_platform: OneBookShelfSourcePlatform;
  items: IngestItemPayload[];
}

const ingestResponseSchema = z.looseObject({ id: z.string() });

// T5.2 (spec 085) — confirmacao do preview chama POST /ingest ja existente
// (Modo 3 da spec 084), sem rota nova de publicacao. parse_case_id (Fase 4)
// linka o item confirmado ao registro de auditoria no backend.
export function useIngestScrapedItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IngestPayload) => {
      const response = await apiPost('/api/v1/admin/scraper/ingest', payload);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao publicar: HTTP ${response.status}`);
      }
      return ingestResponseSchema.parse(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials'] });
    },
  });
}
