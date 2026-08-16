import { useSession } from '@artificio/auth/client';
import { CommentsConversation } from '@artificio/comments/react';
import type { ConversationComment } from '@artificio/comments';
import { useCommunityConversation } from '../hooks/useCommunityConversation';

/**
 * T5.4 (spec 090) — a conversa na ficha do material.
 *
 * Substitui `CommentSection.tsx`, que era a lista plana da spec 074: sem
 * árvore, sem sorts, sem voto, sem edição, e com o dado no `download_comment`
 * local. A conversa inteira agora vive no `accounts.` e a UI é a compartilhada
 * — o `plan.md` da Fase 4 fixa que o componente antigo é "referência, não
 * base".
 *
 * ## O que este arquivo decide, e o que não decide
 *
 * Decide o que é **de domínio do `downloads`**: o rótulo do autor do conteúdo
 * ("autor do material") e quais ações cada visitante enxerga. Não decide
 * layout, acessibilidade nem vocabulário da conversa — isso é do pacote, e
 * duplicar aqui faria os três consumidores divergirem.
 */

/**
 * O rótulo do badge `content_author` é escolha do host, por `source_app`
 * (`contrato-http-v1.md` §2): `badge` é valor de máquina, e "autor do post"
 * mentiria num comentário de material. `AGENTS.md` reserva a linguagem pública
 * ao frontend.
 */
const CONTENT_AUTHOR_LABEL = 'Autor do material';

export function MaterialConversation({ materialId }: Readonly<{ materialId: string }>) {
  const { user } = useSession();
  const { state, sort, changeSort, client, loadMore } = useCommunityConversation({
    materialId,
    userId: user?.id,
  });

  /**
   * Permissões por comentário. O servidor continua sendo a autoridade — isto é
   * só o que a tela **oferece**, para não mostrar botão que sempre voltaria
   * erro (heurística 5 de Nielsen: prevenir em vez de reportar).
   *
   * As regras saem do contrato, não da tela:
   * - só o autor edita e auto-retira (§4, `forbidden_not_author`);
   * - autor não vota no próprio comentário (decisão 5, `self_vote`);
   * - legado não edita nem vota (decisão 6, `legacy_immutable`);
   * - oculto/retirado não aceita ação (§7, `not_votable`);
   * - denunciar a si mesmo não faz sentido e vira ruído na fila.
   *
   * `viewer_is_author` é o que torna as quatro primeiras verificáveis na tela
   * (DEB-090-VIEWER-AUTHOR). Ele vem do servidor como booleano derivado — §2
   * continua proibindo identificador no payload público, e a pergunta que a UI
   * precisa fazer é "é meu?", não "de quem é".
   */
  const permissions = (comment: ConversationComment) => {
    if (!user) return {};

    const isLegacy = comment.legacy !== null;
    const isHidden = comment.state !== 'visible';
    const isMine = comment.viewer_is_author;
    // Os dois estados ocultos **não** são equivalentes para o autor, e §4 os
    // separa: `pending_review_hidden` "continua editável, e a edição não o
    // revela" (:211) — é quando o corpo sumiu que o autor mais precisa do
    // caminho —, enquanto retirado "não volta a ser editável", `403`/
    // `comment_removed` (:214). Tratar os dois como um só ofereceria botão que
    // sempre falha, ou esconderia o que a spec garante.
    const isRemoved = comment.state === 'removed';

    return {
      reply: !isHidden,
      edit: isMine && !isLegacy && !isRemoved,
      withdraw: isMine && !isLegacy && !isRemoved,
      vote: !isMine && !isLegacy && !isHidden,
      report: !isMine && !isHidden,
    };
  };

  return (
    <section aria-labelledby="material-conversation-heading">
      <h2 id="material-conversation-heading">Comentários</h2>
      <CommentsConversation
        state={state}
        sort={sort}
        onSortChange={changeSort}
        client={client}
        canCreate={Boolean(user)}
        permissions={permissions}
        onMoreLoaded={loadMore}
        contentAuthorLabel={CONTENT_AUTHOR_LABEL}
        emptyMessage={
          user
            ? 'Ainda não há comentários. Seja a primeira pessoa a comentar.'
            : 'Ainda não há comentários. Entre com sua conta para comentar.'
        }
      />
    </section>
  );
}
