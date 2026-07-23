import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiPost } from '../services/apiClient';

export interface MaterialCreatePayload {
  slug: string;
  title: string;
  material_type: string;
}

const materialCreatedSchema = z.object({ id: z.string() });

// T2.1 (spec 082) — criacao de material pelo autor. Backend so aceita
// slug/title/material_type e fixa access_kind='external_link' (materials.ts
// POST /, storage gerenciado ainda sem rota real — DEB-073-03).
export function useCreateMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MaterialCreatePayload) => {
      const response = await apiPost('/api/v1/materials', payload);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao criar: HTTP ${response.status}`);
      }
      return materialCreatedSchema.parse(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials', 'mine'] });
    },
  });
}
