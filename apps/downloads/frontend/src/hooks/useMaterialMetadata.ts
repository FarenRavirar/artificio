import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const sourceFilterSchema = z.object({
  facet: z.string(),
  path: z.array(z.string()),
});

// Fase 7 (spec 086, T7.1) — schema ampliado com os campos novos servidos por
// GET /api/v1/material-metadata/:id (routes/materialMetadata.ts): descrição
// rica já sanitizada na leitura, tiles (page_count/file_format/creation_method),
// bloco DETALHES (source_category/source_filters/file_size_text) e cenário.
// Todo campo é nullable/optional — material sem metadata rica (legado) não
// quebra o parse (requisito 15, compatibilidade retroativa).
export const materialMetadataSchema = z.object({
  material_id: z.string(),
  scenario: z.string().nullable().optional(),
  publisher_name: z.string().nullable(),
  credits: z.string().nullable(),
  license_kind: z.string().nullable(),
  license_url: z.string().nullable(),
  file_format: z.string().nullable().optional(),
  file_size_text: z.string().nullable().optional(),
  page_count: z.number().nullable().optional(),
  creation_method: z.string().nullable().optional(),
  source_category: z.string().nullable().optional(),
  source_filters: z.array(sourceFilterSchema).nullable().optional(),
  description_html: z.string().nullable().optional(),
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
