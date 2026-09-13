import { QueryClient } from '@tanstack/react-query';

const OPCOES = {
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
} as const;

/**
 * QueryClient do React Query.
 *
 * NO CLIENTE é singleton, como sempre foi: o cache precisa sobreviver à
 * navegação entre rotas.
 *
 * NO SERVIDOR é UM POR REQUISIÇÃO, e isso não é detalhe (spec 102 T4.2). O
 * módulo vive no processo Node inteiro, então um singleton faria o cache ser
 * compartilhado entre TODOS os visitantes. `initialData` do React Query só
 * inicializa entrada AUSENTE — a partir da segunda requisição o HTML sairia com
 * mesas, vagas e preços guardados de quem acessou antes, por até os 10 min de
 * `gcTime`, ignorando o que o `loader` acabou de buscar. Além do dado velho, o
 * cliente receberia `loader` data diferente do HTML e a hidratação divergiria —
 * o React descartaria o HTML do servidor, que é justamente o conteúdo que o
 * crawler precisa ler. Achado do Codex (P2) na PR #319.
 */
export function criarQueryClient(): QueryClient {
  return new QueryClient(OPCOES);
}

let clienteDoNavegador: QueryClient | undefined;

export function obterQueryClient(): QueryClient {
  if (typeof document === 'undefined') return criarQueryClient();
  clienteDoNavegador ??= criarQueryClient();
  return clienteDoNavegador;
}

/**
 * Instância do navegador para código que roda FORA do React (`broadcastChannel`,
 * `useProfileQuery`, `ProfileContext`) e precisa invalidar query por evento.
 *
 * É a mesma que o `obterQueryClient` devolve no cliente. No servidor cada
 * requisição usa a sua, criada pelo `root.tsx` — este export nunca é alcançado
 * lá, porque os três consumidores só rodam depois da hidratação.
 */
export const queryClient = obterQueryClient();
