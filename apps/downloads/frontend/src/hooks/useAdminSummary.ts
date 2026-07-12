import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const queueSummarySchema = z.object({
  count: z.number(),
  oldest_since: z.string().nullable().optional(),
});

const adminSummarySchema = z.object({
  moderation_queue: queueSummarySchema,
  reports_open: queueSummarySchema,
  degraded_links: z.object({ count: z.number() }),
});

// T1.1/T1.2 (spec 075) — contagem por fila pra sidebar de gestao.
export function useAdminSummary() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'summary'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/admin/summary');
      if (!response.ok) {
        throw new Error(`Falha ao buscar resumo administrativo: HTTP ${response.status}`);
      }
      return adminSummarySchema.parse(await response.json());
    },
    refetchInterval: 60_000,
  });
}
