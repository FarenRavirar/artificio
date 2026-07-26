import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const catalogSystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  node_type: z.enum(['system', 'edition', 'variant']),
  parent_id: z.string().nullable(),
});

const catalogSystemsResponseSchema = z.object({
  items: z.array(catalogSystemSchema),
});

export type CatalogSystem = z.infer<typeof catalogSystemSchema>;

// T8.1 (spec 086, Fase 8) — opções de sistema/edição pra sidebar de filtro,
// via proxy publico do backend downloads (GET /api/v1/materials/catalog-systems,
// routes/materials.ts) que reusa o cache de loadCatalogSystemsFlat. Evita o
// frontend chamar o host do Site direto (CORS cross-origin).
export function useCatalogSystems() {
  return useQuery({
    queryKey: ['downloads', 'catalog-systems'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await apiGet('/api/v1/materials/catalog-systems');
      if (!response.ok) {
        throw new Error(`Falha ao buscar sistemas: HTTP ${response.status}`);
      }
      return catalogSystemsResponseSchema.parse(await response.json()).items;
    },
  });
}
