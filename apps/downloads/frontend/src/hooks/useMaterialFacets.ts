import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const materialTypeFacetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  count: z.number(),
});

const idCountFacetSchema = z.object({
  id: z.string(),
  count: z.number(),
});

const namedFacetSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number(),
});

const materialFacetsSchema = z.object({
  material_types: z.array(materialTypeFacetSchema),
  systems: z.array(idCountFacetSchema),
  editions: z.array(idCountFacetSchema),
  publishers: z.array(namedFacetSchema).default([]),
  authors: z.array(namedFacetSchema).default([]),
});

export type MaterialFacets = z.infer<typeof materialFacetsSchema>;

// T8.1 (spec 086, Fase 8) — material_type NAO e enum (routes/materials.ts:21,
// z.string() livre); as opcoes vem SEMPRE da faceta (so material publicado
// conta), nunca de lista hardcoded no frontend. Endpoint ja existia (Fase 5:
// GET /api/v1/materials/facets), reusado aqui pela sidebar de filtro.
export function useMaterialFacets() {
  return useQuery({
    queryKey: ['downloads', 'material-facets'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const response = await apiGet('/api/v1/materials/facets');
      if (!response.ok) {
        throw new Error(`Falha ao buscar facetas: HTTP ${response.status}`);
      }
      return materialFacetsSchema.parse(await response.json());
    },
  });
}
