import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from '../services/apiClient';

const suggestionSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  raw_value: z.string(),
  source: z.enum(['scraper', 'user']),
  status: z.enum(['pending', 'approved', 'rejected']),
  suggested_by_user_id: z.string().nullable(),
  resolution_action: z.enum(['merge_existing', 'create_alias', 'create_child', 'create_system']).nullable(),
  resolved_node_id: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
});

const candidateSchema = z.object({
  system_id: z.string(),
  name: z.string(),
  path_slug: z.string().nullable(),
  node_type: z.string(),
  parent_id: z.string().nullable(),
  score: z.number(),
  reasons: z.array(z.string()),
});

const candidateResultSchema = z.object({
  suggestion: suggestionSchema,
  candidates: z.array(candidateSchema),
  recommended_action: z.enum(['merge_existing', 'create_alias', 'create_child', 'create_system']),
  analysis: z.object({
    base: z.string(),
    edition_tokens: z.array(z.string()),
    suggested_child_name: z.string().nullable(),
    suggested_child_type: z.enum(['edition', 'variant']),
    has_edition_context: z.boolean(),
    has_qualifier_context: z.boolean(),
  }),
});

const resolvePayloadSchema = z.discriminatedUnion('resolution_type', [
  z.object({ resolution_type: z.literal('merge_existing'), target_node_id: z.string().min(1) }),
  z.object({ resolution_type: z.literal('create_alias'), target_node_id: z.string().min(1) }),
  z.object({ resolution_type: z.literal('create_child'), parent_id: z.string().min(1), node_type: z.enum(['edition', 'variant']), name: z.string().min(1) }),
  z.object({ resolution_type: z.literal('create_system'), name: z.string().min(1), edition_name: z.string().optional() }),
  z.object({ resolution_type: z.literal('reject'), reason: z.string().optional() }),
]);

export type SystemSuggestion = z.infer<typeof suggestionSchema>;
export type SystemCandidate = z.infer<typeof candidateSchema>;
export type ResolveSystemSuggestionPayload = z.infer<typeof resolvePayloadSchema>;

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const parsed = z.object({ error: z.string().optional() }).safeParse(await response.json().catch(() => null));
  return parsed.success && parsed.data.error ? parsed.data.error : fallback;
}

export function useAdminSystemSuggestions() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'system-suggestions', 'pending'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/admin/system-suggestions?status=pending');
      if (!response.ok) throw new Error(await errorMessage(response, 'Falha ao buscar sugestões de sistema.'));
      return z.object({ items: z.array(suggestionSchema) }).parse(await response.json()).items;
    },
  });
}

export function useMySystemSuggestions() {
  return useQuery({
    queryKey: ['downloads', 'system-suggestions', 'mine'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/system-suggestions/mine');
      if (!response.ok) throw new Error(await errorMessage(response, 'Falha ao buscar suas sugestões.'));
      return z.array(suggestionSchema).parse(await response.json());
    },
  });
}

export function useCreateSystemSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { material_id: string; raw_value: string }) => {
      const response = await apiPost('/api/v1/system-suggestions', input);
      if (!response.ok) throw new Error(await errorMessage(response, 'Falha ao enviar sugestão.'));
      return suggestionSchema.parse(await response.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'system-suggestions', 'mine'] }),
  });
}

export function useSystemSuggestionCandidates(suggestionId: string | null) {
  return useQuery({
    queryKey: ['downloads', 'admin', 'system-suggestions', suggestionId, 'candidates'],
    enabled: Boolean(suggestionId),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/admin/system-suggestions/${suggestionId}/candidates`);
      if (!response.ok) throw new Error(await errorMessage(response, 'Falha ao buscar candidatos.'));
      return candidateResultSchema.parse(await response.json());
    },
  });
}

export function useResolveSystemSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ suggestionId, payload }: { suggestionId: string; payload: ResolveSystemSuggestionPayload }) => {
      const normalized = resolvePayloadSchema.parse(payload);
      const response = await apiPost(`/api/v1/admin/system-suggestions/${suggestionId}/resolve`, normalized);
      if (!response.ok) throw new Error(await errorMessage(response, 'Falha ao resolver sugestão.'));
      return z.object({ success: z.literal(true) }).passthrough().parse(await response.json());
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'system-suggestions'] }),
        queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'summary'] }),
        queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'system-suggestions', variables.suggestionId, 'candidates'] }),
      ]);
    },
  });
}
