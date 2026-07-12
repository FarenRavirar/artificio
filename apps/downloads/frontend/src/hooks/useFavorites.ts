import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiDelete, apiGet, apiPost } from '../services/apiClient';
import { favoriteSchema } from '../types/panel';

const favoritesListSchema = z.array(favoriteSchema);

export function useFavorites() {
  return useQuery({
    queryKey: ['downloads', 'favorites'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/favorites');
      if (!response.ok) throw new Error(`Falha ao buscar favoritos: HTTP ${response.status}`);
      return favoritesListSchema.parse(await response.json());
    },
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (materialId: string) => {
      const response = await apiPost('/api/v1/favorites', { material_id: materialId });
      if (!response.ok) throw new Error(`Falha ao favoritar: HTTP ${response.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'favorites'] }),
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (materialId: string) => {
      const response = await apiDelete(`/api/v1/favorites/${materialId}`);
      if (!response.ok) throw new Error(`Falha ao remover favorito: HTTP ${response.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'favorites'] }),
  });
}
