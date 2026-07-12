import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const versionSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  field_name: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  changed_by: z.string(),
  changed_at: z.string(),
});

const historySchema = z.array(versionSchema);

// T3.2 (spec 075) — historico completo de links ja usados (nao so o atual).
export function useAdminLinkHistory(materialId: string | undefined) {
  return useQuery({
    queryKey: ['downloads', 'admin', 'link-history', materialId],
    enabled: Boolean(materialId),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/admin/materials/${materialId}/link-history`);
      if (!response.ok) {
        throw new Error(`Falha ao buscar histórico de links: HTTP ${response.status}`);
      }
      return historySchema.parse(await response.json());
    },
  });
}
