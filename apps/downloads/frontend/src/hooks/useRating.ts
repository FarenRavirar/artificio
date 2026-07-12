import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPut } from '../services/apiClient';
import { ratingSchema } from '../types/panel';

const ratingsListSchema = z.array(ratingSchema);

export function useRatings(materialId: string | undefined) {
  return useQuery({
    queryKey: ['downloads', 'ratings', materialId],
    enabled: Boolean(materialId),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/ratings/${materialId}`);
      if (!response.ok) throw new Error(`Falha ao buscar avaliações: HTTP ${response.status}`);
      return ratingsListSchema.parse(await response.json());
    },
  });
}

// D111 item 5 (spec 074) — 403 quando conta ainda nao tem download registrado
// deste material; UI trata isso como guard, nao erro generico.
export function useSubmitRating(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { score: number; comment?: string | null }) => {
      const response = await apiPut('/api/v1/ratings', { material_id: materialId, ...input });
      if (response.status === 403) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Avaliação não permitida.');
      }
      if (!response.ok) throw new Error(`Falha ao avaliar: HTTP ${response.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'ratings', materialId] }),
  });
}
