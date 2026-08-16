import { useSession } from '@artificio/auth/client';
// `/react` e não o root: o barrel arrasta `node:crypto` via `treeCursor.js` e
// quebra o build do Astro (ver `useSiteConversation.ts`).
import { CommentsConversation, type ConversationComment } from '@artificio/comments/react';
import '@artificio/comments/styles.css';

import { useSiteConversation } from './useSiteConversation.js';

/**
 * T6.4/T6.5 (spec 090) — ilha da conversa abaixo do artigo.
 *
 * ## Por que ilha, e não página inteira em React
 *
 * O blog é SSG: a página do post é HTML gerado no build (`getStaticPaths`), e é
 * isso que sustenta o SEO e o Lighthouse do site. Hidratar a página toda para
 * exibir comentários trocaria a métrica principal do produto por uma seção
 * secundária. `client:visible` (no `.astro` que monta este componente) adia o
 * JavaScript até o leitor rolar até aqui — quem lê só o artigo nunca paga o
 * custo do bundle.
 *
 * ## `realm` vem de fora, e isso não é preferência
 *
 * O mesmo `dist` do Astro é publicado em beta e em produção. Inferir o realm do
 * bundle daria o mesmo valor nos dois ambientes; ele chega do servidor, via
 * atributo, e vale para a chave do cache do `CommentsResource` (T4.7).
 */

/**
 * Legado do `site` é **imutável, mas respondível** (decisão 23).
 *
 * Os 25 comentários importados do WordPress não têm conta por trás
 * (`legacy_author_name`, autoria não verificada), então editar, retirar ou
 * votar neles não faz sentido: não há autor a quem atribuir a ação, e votar
 * daria placar a fala que nunca participou do sistema de reputação. Responder,
 * sim — é o que preserva o acervo como conversa viva em vez de arquivo morto.
 */
export function permissionsFor(user: unknown) {
  return (comment: ConversationComment) => {
    if (!user) return {};

    const isLegacy = comment.legacy !== null;
    const isHidden = comment.state !== 'visible';
    const isMine = comment.viewer_is_author;
    // Retirado não volta a ser editável (§4, `403`/`comment_removed`), enquanto
    // `pending_review_hidden` continua editável e a edição não o revela. Tratar
    // os dois como um só ofereceria botão que sempre falha.
    const isRemoved = comment.state === 'removed';

    return {
      reply: !isHidden,
      edit: isMine && !isLegacy && !isRemoved,
      withdraw: isMine && !isLegacy && !isRemoved,
      vote: !isMine && !isLegacy && !isHidden,
      report: !isMine && !isHidden,
    };
  };
}

export interface PostConversationProps {
  /** `String(post.id)` — gravado no HTML pelo Astro em tempo de build. */
  readonly postId: string;
  readonly realm?: 'beta' | 'prod';
}

export function PostConversation({ postId, realm = 'prod' }: PostConversationProps) {
  const { user } = useSession();
  const { state, sort, changeSort, client, loadMore, reload } = useSiteConversation({
    postId,
    userId: user?.id,
    realm,
  });

  return (
    <section aria-labelledby="post-conversation-heading" className="post-conversation container">
      <h2 id="post-conversation-heading">Comentários</h2>
      <CommentsConversation
        state={state}
        sort={sort}
        onSortChange={changeSort}
        client={client}
        canCreate={Boolean(user)}
        permissions={permissionsFor(user)}
        // Sem isto, a conversa anuncia "Comentário publicado." e continua
        // exibindo a árvore anterior: a resposta da mutação não entra no
        // `CommentsResource`, que só troca de dado ao reler. O comentário
        // recém-escrito some da tela até uma recarga externa — o pior sinal
        // possível logo depois de publicar, porque lê como fala perdida.
        onActionComplete={reload}
        onMoreLoaded={loadMore}
        emptyMessage={
          user
            ? 'Ainda não há comentários. Seja a primeira pessoa a comentar.'
            : 'Ainda não há comentários. Entre com sua conta para comentar.'
        }
      />
    </section>
  );
}

export default PostConversation;
