import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';
import { materialVersionSchema } from '../types/panel';

const historySchema = z.array(materialVersionSchema);

// T2.3/criterio de aceite 2 e 3 (spec 074) — historico de edicao por campo.
export function useMaterialHistory(materialId: string | undefined) {
  return useQuery({
    queryKey: ['downloads', 'materials', materialId, 'history'],
    enabled: Boolean(materialId),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/materials/${materialId}/history`);
      if (!response.ok) throw new Error(`Falha ao buscar histórico: HTTP ${response.status}`);
      return historySchema.parse(await response.json());
    },
  });
}
