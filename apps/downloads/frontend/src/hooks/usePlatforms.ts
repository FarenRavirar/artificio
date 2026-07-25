import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from '../services/apiClient';

const platformSchema = z.object({
  slug: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  supports_auto_scrape: z.boolean(),
  supports_price_recheck: z.boolean(),
  parser_kind: z.string(),
  created_at: z.string(),
});
export type Platform = z.infer<typeof platformSchema>;

const listPlatformsResponseSchema = z.object({
  items: z.array(platformSchema),
});

// T6.4/T8.2 (spec 085, Fase 6/8) — CRUD do registry de plataformas: admin
// cadastra site novo (100+ previstos) sem deploy.
export function usePlatforms() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'platforms'],
    queryFn: async (): Promise<Platform[]> => {
      const response = await apiGet('/api/v1/admin/scraper/platforms');
      if (!response.ok) {
        throw new Error(`Falha ao listar plataformas: HTTP ${response.status}`);
      }
      return listPlatformsResponseSchema.parse(await response.json()).items;
    },
  });
}

export interface CreatePlatformPayload {
  slug: string;
  name: string;
  domain: string | null;
  supports_auto_scrape?: boolean;
  supports_price_recheck?: boolean;
  parser_kind?: string;
}

export function useCreatePlatform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePlatformPayload): Promise<Platform> => {
      const response = await apiPost('/api/v1/admin/scraper/platforms', payload);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao cadastrar plataforma: HTTP ${response.status}`);
      }
      return platformSchema.parse(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'platforms'] });
    },
  });
}
