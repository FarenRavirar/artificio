import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../services/apiClient';
import { materialMetadataSchema } from './useMaterialMetadata';

export interface MaterialMetadataPatch {
  publisher_name?: string | null;
}

// T-editora (spec 075) — grava so publisher_name por ora (demais campos de
// download_material_metadata ja existem no schema mas nao tem UI ainda).
export function useUpdateMaterialMetadata(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: MaterialMetadataPatch) => {
      const response = await apiPut(`/api/v1/material-metadata/${materialId}`, patch);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao salvar metadados: HTTP ${response.status}`);
      }
      return materialMetadataSchema.parse(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'material-metadata', materialId] });
    },
  });
}
