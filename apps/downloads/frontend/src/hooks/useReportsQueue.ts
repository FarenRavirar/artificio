import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPatch } from '../services/apiClient';

const reportSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  reporter_user_id: z.string().nullable(),
  category: z.string(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  case_state: z.enum(['open', 'in_review', 'resolved', 'dismissed']),
  details: z.string().nullable(),
  resolution_note: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});

const reportsSchema = z.array(reportSchema);

// T4.1 (spec 075) — fila de denuncia com prioridade P0-P3.
export function useReportsQueue() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'reports'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/reports');
      if (!response.ok) {
        throw new Error(`Falha ao buscar denúncias: HTTP ${response.status}`);
      }
      return reportsSchema.parse(await response.json());
    },
  });
}

// T4.2 (spec 075) — decisao de merito (in_review/resolved/dismissed).
export function useReportDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, case_state, resolution_note }: { id: string; case_state: 'in_review' | 'resolved' | 'dismissed'; resolution_note?: string }) => {
      const response = await apiPatch(`/api/v1/reports/${id}`, { case_state, resolution_note });
      if (!response.ok) {
        throw new Error(`Falha ao decidir denúncia: HTTP ${response.status}`);
      }
      return reportSchema.parse(await response.json());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'reports'] });
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'summary'] });
    },
  });
}
