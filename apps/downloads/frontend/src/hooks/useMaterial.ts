import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/apiClient';
import { materialSchema, type Material } from '../types/material';

// T2.1 (spec 070) — ficha publica por slug, so material publicado.
export function useMaterial(slug: string | undefined) {
  return useQuery<Material | null>({
    queryKey: ['downloads', 'material', slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/materials/${slug}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Falha ao buscar material: HTTP ${response.status}`);
      }
      const json = await response.json();
      return materialSchema.parse(json);
    },
  });
}
