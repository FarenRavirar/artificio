import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const metricsSchema = z.object({
  per_material: z.array(
    z.object({
      material_id: z.string(),
      material_slug: z.string(),
      material_title: z.string(),
      total_downloads: z.coerce.number(),
      total_views: z.coerce.number(),
    }),
  ),
  note: z.string(),
});

// T6.3 (spec 075) — metricas administrativas completas.
export function useAdminMetrics() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'metrics'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/admin/metrics');
      if (!response.ok) {
        throw new Error(`Falha ao buscar métricas: HTTP ${response.status}`);
      }
      return metricsSchema.parse(await response.json());
    },
  });
}
