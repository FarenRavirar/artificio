import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const myReportSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  category: z.string(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  case_state: z.enum(['open', 'in_review', 'resolved', 'dismissed']),
  details: z.string().nullable(),
  resolution_note: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});

const myReportsSchema = z.array(myReportSchema);

// DEB-074-02 (spec 074/075) — denuncias abertas pelo proprio usuario.
export function useMyReports() {
  return useQuery({
    queryKey: ['downloads', 'reports', 'mine'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/reports/mine');
      if (!response.ok) {
        throw new Error(`Falha ao buscar minhas denúncias: HTTP ${response.status}`);
      }
      return myReportsSchema.parse(await response.json());
    },
  });
}
