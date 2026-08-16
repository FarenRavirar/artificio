/**
 * Tudo vem de `/react`, e **não** do root.
 *
 * O barrel `.` reexporta `treeCursor.js`, que importa `node:crypto` (assinatura
 * de cursor é código de servidor). O Vite do `downloads` externaliza `node:*` e
 * engole isso; o build do Astro não, e falha com `"createHmac" is not exported
 * by "__vite-browser-external"` — medido em 2026-08-16.
 */
import {
  createConversationTransport,
  useConversationHost,
  type ConversationHostConfig,
} from '@artificio/comments/react';

/**
 * T6.4 (spec 090) — host da conversa no `site`.
 *
 * ## O que este arquivo ainda decide
 *
 * A mecânica (resource, transporte, paginação de `more`, recarga) vive em
 * `@artificio/comments/react` desde a extração da PR #264 — antes disso, `site`
 * e `downloads` mantinham a mesma implementação copiada, e as correções de
 * review de um não chegavam ao outro. O que sobra aqui é a configuração do
 * módulo: qual assunto, qual rota, qual origem.
 *
 * ## Duas particularidades do `site` em relação ao `downloads`
 *
 * A página é **estática**: o blog é SSG e o `subject_id` vem do
 * `getStaticPaths`, gravado no HTML em tempo de build — não existe roteador no
 * cliente para lê-lo, por isso ele entra como parâmetro.
 *
 * E a fachada é **same-origin**: o Express do `site` serve o mesmo host do
 * conteúdo estático, então `baseUrl` fica vazio. O `downloads` precisa de
 * `VITE_API_URL` porque frontend e backend são origens distintas lá.
 */

/** `subject_type` do módulo (`postSubjectGuard.ts`, mesmo literal). */
export const SITE_SUBJECT_TYPE = 'site.post';

const CONFIG: ConversationHostConfig = {
  subjectType: SITE_SUBJECT_TYPE,
  sourceApp: 'site',
  conversationPath: '/api/v1/community/conversation',
  reportPath: (commentId) => `/api/v1/community/comments/${encodeURIComponent(commentId)}/reports`,
  // `baseUrl` omitido: same-origin. A ilha React fala com o Express do próprio
  // `site`, e é por isso que a CSP (`connect-src 'self'`) já cobre a conversa.
};

// Construído no escopo do módulo, não a cada render.
const commentsClient = createConversationTransport(CONFIG);

export interface UseSiteConversationOptions {
  /** `String(post.id)` — vem do `getStaticPaths`, gravado no HTML no build. */
  readonly postId: string;
  /** Identidade da conta; `undefined` quando anônimo. Entra na chave do cache. */
  readonly userId?: string;
  readonly realm?: 'beta' | 'prod';
}

export function useSiteConversation({ postId, userId, realm = 'prod' }: UseSiteConversationOptions) {
  return useConversationHost({
    subjectId: postId,
    userId,
    realm,
    config: CONFIG,
    client: commentsClient,
  });
}
