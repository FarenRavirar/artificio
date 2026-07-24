import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPut } from '../services/apiClient';

const mediaItemSchema = z.object({
  material_id: z.string(),
  material_slug: z.string(),
  material_title: z.string(),
  editorial_state: z.string(),
  cover_image_url: z.string().nullable(),
});

const mediaListSchema = z.object({ items: z.array(mediaItemSchema) });

// T2.7 (spec 082) — Gestao de Midias: lista todos os materiais com capa
// resolvida (qualquer estado editorial), pra edicao pelo admin/moderador.
export function useAdminMedia() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'media'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/admin/media');
      if (!response.ok) {
        throw new Error(`Falha ao buscar mídias: HTTP ${response.status}`);
      }
      return mediaListSchema.parse(await response.json());
    },
  });
}

// Reusa PUT /material-metadata/:id (ja existente, aceita dono ou
// moderator/admin) so pra atualizar cover_image_url.
export function useUpdateCoverImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ materialId, coverImageUrl }: { materialId: string; coverImageUrl: string }) => {
      const response = await apiPut(`/api/v1/material-metadata/${materialId}`, {
        cover_image_url: coverImageUrl.trim() || null,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao salvar capa: HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'media'] });
    },
  });
}
