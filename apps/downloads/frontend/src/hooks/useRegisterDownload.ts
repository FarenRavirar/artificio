import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../services/apiClient';

// T3.1/T3.2 (spec 074) — registra clique logado no CTA como download,
// dedup por (conta, material) resolvido no backend (download_user_material_download).
export function useRegisterDownload() {
  return useMutation({
    mutationFn: async (materialId: string) => {
      const response = await apiPost('/api/v1/downloads', { material_id: materialId });
      if (!response.ok && response.status !== 401) {
        throw new Error(`Falha ao registrar download: HTTP ${response.status}`);
      }
      return response.ok;
    },
  });
}
