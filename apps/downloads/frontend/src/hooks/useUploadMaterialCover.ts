import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from '../services/apiClient';

const managedCoverResponseSchema = z.object({
  cover_image_url: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export const coverResponseSchema = z.union([
  managedCoverResponseSchema,
  z.object({
    cover_image_url: z.url(),
    external: z.literal(true),
  }),
]);

export function useUploadMaterialCover(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/v1/materials/${materialId}/cover?filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao enviar capa: HTTP ${response.status}`);
      }
      return managedCoverResponseSchema.parse(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['downloads', 'material-metadata', materialId] });
    },
  });
}

export function useCoverCapabilities() {
  return useQuery({
    queryKey: ['downloads', 'cover-capabilities'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/materials/cover-capabilities');
      if (!response.ok) throw new Error(`Falha ao consultar capas: HTTP ${response.status}`);
      return z.object({ cloudinary_enabled: z.boolean() }).parse(await response.json());
    },
  });
}

export function useImportMaterialCoverUrl(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const response = await apiPost(`/api/v1/materials/${materialId}/cover-url`, { url });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao importar capa: HTTP ${response.status}`);
      }
      return coverResponseSchema.parse(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'materials', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['downloads', 'material-metadata', materialId] });
    },
  });
}
