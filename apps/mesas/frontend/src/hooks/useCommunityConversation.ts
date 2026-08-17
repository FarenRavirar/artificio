// Lógica pura vem do ROOT; só o que depende de React sai de `/react`. A
// separação é a trava do requisito 21b (`packageBoundary.test.ts`): importar
// daqui funcionaria, mas apagaria a fronteira que mantém o root utilizável em
// backend e SSR.
import {
  createConversationTransport,
  useConversationHost,
  type ConversationHostConfig,
} from '@artificio/comments/react';

/**
 * T7.8 (spec 090) — host da conversa no `mesas`.
 *
 * A mecânica (resource, transporte, paginação de `more`, recarga) vive em
 * `@artificio/comments/react`. Este arquivo é só a configuração do módulo: qual
 * assunto, qual rota, qual origem — exatamente como
 * `downloads/hooks/useCommunityConversation.ts`.
 *
 * A duplicação que existia entre `downloads` e `site` antes da extração da
 * PR #264 custou duas correções de review que nunca cruzaram de um para o
 * outro; nascer sobre o host compartilhado é o que impede o `mesas` de repetir
 * isso.
 *
 * ## O contrato de quem chama o quê
 *
 * O pacote não conhece URL, cookie nem credencial (`transport.ts`): ele define
 * capacidades (`thread.read`, `comment.create`, …) e o host as liga à fachada
 * do próprio app. Aqui elas viram chamadas para
 * `/api/v1/community/conversation`, com `credentials: 'include'` — o navegador
 * **nunca** alcança `/internal/v1` (requisito 6a), e a credencial de serviço
 * vive só no backend.
 */

/** `subject_type` do módulo (`tableSubjectGuard.ts`, mesmo literal). */
export const MESAS_SUBJECT_TYPE = 'mesas.table';

const CONFIG: ConversationHostConfig = {
  subjectType: MESAS_SUBJECT_TYPE,
  sourceApp: 'mesas',
  conversationPath: '/api/v1/community/conversation',
  reportPath: (commentId) => `/api/v1/community/comments/${encodeURIComponent(commentId)}/reports`,
  // Frontend e backend são origens distintas neste módulo, como no `downloads`
  // — diferente do `site`, que é same-origin.
  baseUrl: import.meta.env.VITE_API_URL ?? '',
};

// Construído no escopo do módulo, não a cada render.
const commentsClient = createConversationTransport(CONFIG);

export interface UseCommunityConversationOptions {
  /** `tables.id` (UUID), não o slug: o slug muda, o id não. */
  readonly tableId: string;
  /** Identidade da conta; `undefined` quando anônimo. Entra na chave do cache. */
  readonly userId?: string;
  readonly realm?: 'beta' | 'prod';
}

/**
 * Monta resource, client e paginação de `more` para a página de uma mesa.
 *
 * O resource é criado **por assunto e identidade** (T4.7): trocar de conta ou de
 * mesa descarta o que estava em memória, em vez de mostrar a conversa da sessão
 * anterior.
 */
export function useCommunityConversation({
  tableId,
  userId,
  realm = 'prod',
}: UseCommunityConversationOptions) {
  return useConversationHost({
    subjectId: tableId,
    userId,
    realm,
    config: CONFIG,
    client: commentsClient,
  });
}
