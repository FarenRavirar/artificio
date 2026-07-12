import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPatch, apiPost } from '../services/apiClient';
import { materialSchema } from '../types/material';

const queueSchema = z.array(materialSchema);

// T2.1 (spec 075) — fila de moderacao, so material em revisao.
export function useModerationQueue() {
  return useQuery({
    queryKey: ['downloads', 'moderation', 'queue'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/moderation/queue');
      if (!response.ok) {
        throw new Error(`Falha ao buscar fila de moderação: HTTP ${response.status}`);
      }
      return queueSchema.parse(await response.json());
    },
  });
}

const batchResultSchema = z.object({
  results: z.array(z.object({ id: z.string(), status: z.enum(['updated', 'skipped']), reason: z.string().optional() })),
});

// T2.2/T2.3 (spec 075) — acoes batch (aprovar/reprovar/arquivar).
export function useModerationBatchAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ids, reason }: { action: 'approve' | 'reject' | 'archive'; ids: string[]; reason?: string }) => {
      const response = await apiPatch(`/api/v1/moderation/batch/${action}`, { ids, reason });
      if (!response.ok) {
        throw new Error(`Falha na ação em lote: HTTP ${response.status}`);
      }
      return batchResultSchema.parse(await response.json());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'moderation', 'queue'] });
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'summary'] });
    },
  });
}

// T2.1 (spec 075) — aprovar/reprovar individual (reusa /moderation/:id/*).
export function useModerationSingleAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) => {
      const response = await apiPost(`/api/v1/moderation/${id}/${action}`, action === 'reject' ? { reason } : undefined);
      if (!response.ok) {
        throw new Error(`Falha na moderação: HTTP ${response.status}`);
      }
      return materialSchema.parse(await response.json());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'moderation', 'queue'] });
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'summary'] });
    },
  });
}
