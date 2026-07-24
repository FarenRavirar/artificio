import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from '../services/apiClient';

const emailLogItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  material_id: z.string().nullable(),
  kind: z.enum(['material_rejected', 'material_approved']),
  to_email: z.string().nullable(),
  status: z.enum(['sent', 'failed', 'skipped_no_email']),
  error_detail: z.string().nullable(),
  attempts: z.number(),
  created_at: z.string(),
  last_attempt_at: z.string(),
});

const emailLogListSchema = z.object({ items: z.array(emailLogItemSchema) });

// T6.2 (spec 083) — logs de envio com falha/skip, para reenvio manual.
export function useAdminEmailLog(status?: 'failed' | 'skipped_no_email') {
  return useQuery({
    queryKey: ['downloads', 'admin', 'email-log', status],
    queryFn: async () => {
      const query = status ? `?status=${status}` : '';
      const response = await apiGet(`/api/v1/admin/email-log${query}`);
      if (!response.ok) {
        throw new Error(`Falha ao buscar logs de e-mail: HTTP ${response.status}`);
      }
      return emailLogListSchema.parse(await response.json());
    },
  });
}

export function useRetryEmailLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPost(`/api/v1/admin/email-log/${id}/retry`);
      const body = await response.json().catch(() => null);
      if (!response.ok && response.status !== 502) {
        throw new Error(body?.error ?? `Falha ao reenviar e-mail: HTTP ${response.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'email-log'] });
    },
  });
}
