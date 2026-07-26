import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

export const materialMetadataSchema = z.object({
  material_id: z.string(),
  publisher_name: z.string().nullable(),
  credits: z.string().nullable(),
  license_kind: z.string().nullable(),
  license_url: z.string().nullable(),
  // D119 (spec 084) — sempre 'pt' para material publicado.
  language: z.literal('pt').nullable(),
});

// T-editora (spec 075) — metadados publicos do material (so credito de
// editora usado na ficha por ora; demais campos ja existem no schema).
export function useMaterialMetadata(materialId: string | undefined) {
  return useQuery({
    queryKey: ['downloads', 'material-metadata', materialId],
    enabled: Boolean(materialId),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/material-metadata/${materialId}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Falha ao buscar metadados: HTTP ${response.status}`);
      }
      return materialMetadataSchema.parse(await response.json());
    },
  });
}
