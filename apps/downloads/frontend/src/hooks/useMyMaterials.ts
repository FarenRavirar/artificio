import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/apiClient';
import { materialSchema } from '../types/material';
import { z } from 'zod';

const myMaterialsSchema = z.array(materialSchema);

// T1.2 (spec 074) — "Meus materiais": todos os estados editoriais.
export function useMyMaterials() {
  return useQuery({
    queryKey: ['downloads', 'materials', 'mine'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/materials/mine');
      if (!response.ok) {
        throw new Error(`Falha ao buscar meus materiais: HTTP ${response.status}`);
      }
      return myMaterialsSchema.parse(await response.json());
    },
  });
}
