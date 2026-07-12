import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const creatorProfileSchema = z.object({
  id: z.string(),
  slug: z.string(),
  display_name: z.string(),
  bio: z.string().nullable(),
  materials: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      summary: z.string().nullable(),
      material_type: z.string(),
    }),
  ),
});

export type CreatorProfile = z.infer<typeof creatorProfileSchema>;

// T4.1 (spec 073) — perfil publico de criador; funciona sem conta associada
// no proprio contrato do backend (creator.user_id nunca sai no JSON).
export function useCreator(slug: string | undefined) {
  return useQuery<CreatorProfile | null>({
    queryKey: ['downloads', 'creator', slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/creators/${slug}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Falha ao buscar criador: HTTP ${response.status}`);
      }
      const json = await response.json();
      return creatorProfileSchema.parse(json);
    },
  });
}
