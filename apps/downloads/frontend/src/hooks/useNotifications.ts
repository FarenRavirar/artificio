import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPatch } from '../services/apiClient';
import { notificationSchema } from '../types/panel';

const notificationsListSchema = z.array(notificationSchema);

export function useNotifications() {
  return useQuery({
    queryKey: ['downloads', 'notifications'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/notifications');
      if (!response.ok) throw new Error(`Falha ao buscar notificações: HTTP ${response.status}`);
      return notificationsListSchema.parse(await response.json());
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch(`/api/v1/notifications/${id}/read`);
      if (!response.ok) throw new Error(`Falha ao marcar notificação: HTTP ${response.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'notifications'] }),
  });
}
