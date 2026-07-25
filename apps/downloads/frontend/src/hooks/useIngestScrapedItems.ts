import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiPost } from '../services/apiClient';
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

// T8.3 (spec 085, Fase 8) — plataforma deixou de ser enum fechado
// (DownloadSourcePlatform ja e hibrido, apps/downloads/backend/src/db/types.ts);
// no frontend, source_platform passa a ser o slug detectado por
// useParseHtml (nunca escolhido pelo admin), qualquer string do registry.
export interface IngestPayload {
  source_platform: string;
  items: IngestItemPayload[];
}

const ingestResponseSchema = z.looseObject({
  id: z.string(),
  items_created: z.number(),
  items_skipped_duplicate: z.number(),
  items_skipped_not_portuguese: z.number(),
  items_skipped_error: z.number(),
});
export type IngestResponse = z.infer<typeof ingestResponseSchema>;

// Achado real (review PR #200, Codex): /ingest sempre responde 200, mesmo
// quando o pipeline pula o item (duplicata/idioma/erro) — items_created=0
// nesse caso. Sem checar o contador, a UI anunciava "publicado" mesmo sem
// criar nada. Motivo do skip vem dos contadores da run, nunca inventado.
export function describeIngestOutcome(result: IngestResponse): string | null {
  if (result.items_created > 0) return null;
  if (result.items_skipped_duplicate > 0) return 'Item pulado: já existe material duplicado.';
  if (result.items_skipped_not_portuguese > 0) return 'Item pulado: idioma não identificado como português.';
  if (result.items_skipped_error > 0) return 'Item pulado: erro durante o processamento.';
  return 'Item não foi publicado (motivo não identificado pela run).';
}

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
