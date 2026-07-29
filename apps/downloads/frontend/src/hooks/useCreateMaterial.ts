import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiPost } from '../services/apiClient';

export interface MaterialCreatePayload {
  title: string;
  material_type_id: string;
}

const materialCreatedSchema = z.object({ id: z.string().min(1) });

// T2.1 (spec 082) + T7.5 (spec 089) — backend recebe titulo/tipo, deriva o
// slug unico e fixa access_kind='external_link'.
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
