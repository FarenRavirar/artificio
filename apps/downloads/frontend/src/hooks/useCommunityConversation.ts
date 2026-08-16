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
 * T5.4 (spec 090) — host da conversa no `downloads`.
 *
 * ## O que este arquivo ainda decide
 *
 * A mecânica (resource, transporte, paginação de `more`, recarga) vive em
 * `@artificio/comments/react` desde a extração da PR #264. Antes disso este
 * arquivo tinha 265 linhas idênticas às do `site`, e a duplicação cobrou o
 * preço previsto: **duas correções de review aplicadas no `site` nunca
 * chegaram aqui** — `reload` síncrono (o "Comentário publicado." aparecia antes
 * de a árvore nova chegar) e `setPages` não-funcional (duas páginas de `more`
 * concorrentes descartavam uma à outra). Os dois estavam em produção; adotar o
 * host compartilhado corrige ambos.
 *
 * O que sobra aqui é a configuração do módulo: qual assunto, qual rota, qual
 * origem.
 *
 * ## O contrato de quem chama o quê
 *
 * O pacote não conhece URL, cookie nem credencial (`transport.ts`): ele define
 * capacidades (`thread.read`, `comment.create`, …) e o host as liga à fachada
 * do próprio app. Aqui elas viram chamadas para
 * `/api/v1/community/conversation`, com `credentials: 'include'` — o navegador
 * **nunca** alcança `/internal/v1` (requisito 6a), e a credencial de serviço
 * vive só no backend.
 *
 * ## Por que não React Query, sendo que o resto do app usa
 *
 * Estado de conversa é do `CommentsResource` (T4.6): ele guarda a última
 * leitura boa e degrada para `stale`/`unavailable` sozinho, com a chave
 * incluindo a identidade da conta (T4.7) — coisas que teriam de ser
 * reconstruídas sobre React Query e divergiriam do que os outros consumidores
 * fazem. A moderação usa React Query porque lá o contrato é de listas paginadas
 * comuns.
 */

/** `subject_type` do módulo (`materialSubjectGuard.ts`, mesmo literal). */
export const DOWNLOADS_SUBJECT_TYPE = 'downloads.material';

const CONFIG: ConversationHostConfig = {
  subjectType: DOWNLOADS_SUBJECT_TYPE,
  sourceApp: 'downloads',
  conversationPath: '/api/v1/community/conversation',
  reportPath: (commentId) => `/api/v1/community/comments/${encodeURIComponent(commentId)}/reports`,
  // Frontend e backend são origens distintas neste módulo — diferente do
  // `site`, que é same-origin.
  baseUrl: import.meta.env.VITE_API_URL ?? '',
};

// Construído no escopo do módulo, não a cada render.
const commentsClient = createConversationTransport(CONFIG);

export interface UseCommunityConversationOptions {
  readonly materialId: string;
  /** Identidade da conta; `undefined` quando anônimo. Entra na chave do cache. */
  readonly userId?: string;
  readonly realm?: 'beta' | 'prod';
}

/**
 * Monta resource, client e paginação de `more` para uma ficha de material.
 *
 * O resource é criado **por assunto e identidade** (T4.7): trocar de conta ou de
 * material descarta o que estava em memória, em vez de mostrar a conversa da
 * sessão anterior.
 */
export function useCommunityConversation({
  materialId,
  userId,
  realm = 'prod',
}: UseCommunityConversationOptions) {
  return useConversationHost({
    subjectId: materialId,
    userId,
    realm,
    config: CONFIG,
    client: commentsClient,
  });
}
