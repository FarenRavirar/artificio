import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '../services/apiClient';

export interface MaterialPatch {
  title?: string;
  summary?: string | null;
  description?: string | null;
  external_url?: string | null;
}

// T2.1/T2.2 (spec 074) — edicao de material pelo autor, incluindo o link de
// destino (D111 item 7). Backend ja grava historico por campo (materials.ts
// PATCH /:id, spec 070).
export function useUpdateMaterial(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: MaterialPatch) => {
      const response = await apiPatch(`/api/v1/materials/${materialId}`, patch);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao salvar: HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials', materialId, 'history'] });
    },
  });
}
