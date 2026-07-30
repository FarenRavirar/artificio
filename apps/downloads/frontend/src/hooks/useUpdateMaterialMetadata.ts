import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../services/apiClient';
import { materialMetadataSchema } from './useMaterialMetadata';

export interface MaterialMetadataPatch {
  publisher_name?: string | null;
  description_markdown?: string | null;
  authors?: string[];
  artists?: string[];
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
      // Achado real (review PR #209, CodeRabbit): GestaoEditarDescricaoPage
      // lê description_html via useAdminMedia (['downloads', 'admin',
      // 'media']), não via useMaterialMetadata — sem invalidar essa chave
      // também, o editor mostrava HTML desatualizado até reload manual.
      queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'media'] });
      // Achado real (review PR #230, Codex): a task list do autor (T9.8) passou a
      // derivar "Descrição e créditos" de material.description_markdown/authors
      // vindos de useMyMaterials. Sem invalidar 'materials/mine' aqui, salvar
      // descrição/autores não repinta o ✓ até recarregar a página.
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials', 'mine'] });
    },
  });
}
