import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const materialTypeSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  status: z.literal('active'),
});

const responseSchema = z.object({ items: z.array(materialTypeSchema) });

export type MaterialTypeOption = z.infer<typeof materialTypeSchema>;

export function useMaterialTypes() {
  return useQuery({
    queryKey: ['downloads', 'material-types'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/materials/types');
      if (!response.ok) throw new Error(`Falha ao buscar tipos de material: HTTP ${response.status}`);
      return responseSchema.parse(await response.json()).items;
    },
    staleTime: 60_000,
  });
}
