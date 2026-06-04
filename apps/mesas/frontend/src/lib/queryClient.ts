import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient global para React Query
 * Configuração otimizada para produção
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (anteriormente cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 3, // Retry automático (alinhado com apiClient)
    },
    mutations: {
      retry: 1, // Retry em mutations
    },
  },
});
