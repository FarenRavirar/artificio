import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiDelete, apiGet, apiPost } from '../services/apiClient';
import { collectionItemSchema, collectionSchema } from '../types/panel';

const collectionsListSchema = z.array(collectionSchema);
const collectionItemsListSchema = z.array(collectionItemSchema);

export function useCollections() {
  return useQuery({
    queryKey: ['downloads', 'collections'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/collections');
      if (!response.ok) throw new Error(`Falha ao buscar coleções: HTTP ${response.status}`);
      return collectionsListSchema.parse(await response.json());
    },
  });
}

export function useCollectionItems(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['downloads', 'collections', collectionId, 'items'],
    enabled: Boolean(collectionId),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/collections/${collectionId}/items`);
      if (!response.ok) throw new Error(`Falha ao buscar itens da coleção: HTTP ${response.status}`);
      return collectionItemsListSchema.parse(await response.json());
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slug: string; title: string; is_public?: boolean }) => {
      const response = await apiPost('/api/v1/collections', input);
      if (!response.ok) throw new Error(`Falha ao criar coleção: HTTP ${response.status}`);
      return collectionSchema.parse(await response.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'collections'] }),
  });
}

export function useAddCollectionItem(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (materialId: string) => {
      const response = await apiPost(`/api/v1/collections/${collectionId}/items`, { material_id: materialId });
      if (!response.ok) throw new Error(`Falha ao adicionar item: HTTP ${response.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'collections', collectionId, 'items'] }),
  });
}

export function useRemoveCollectionItem(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (materialId: string) => {
      const response = await apiDelete(`/api/v1/collections/${collectionId}/items/${materialId}`);
      if (!response.ok) throw new Error(`Falha ao remover item: HTTP ${response.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'collections', collectionId, 'items'] }),
  });
}
