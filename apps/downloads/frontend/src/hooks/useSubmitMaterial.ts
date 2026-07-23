import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../services/apiClient';

// T2.2 (spec 082) — envio do rascunho para moderacao (draft -> in_review).
// Backend ja valida ownership e transicao de estado (moderation.ts POST /:id/submit).
export function useSubmitMaterial(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiPost(`/api/v1/moderation/${materialId}/submit`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao enviar para revisão: HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials', 'mine'] });
    },
  });
}
