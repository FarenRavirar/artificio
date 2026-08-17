import { useSession } from '@artificio/auth/client';
import { CommentsConversation } from '@artificio/comments/react';
import type { ConversationComment } from '@artificio/comments';
import { useCommunityConversation } from '../hooks/useCommunityConversation';

/**
 * T7.4/T7.8 (spec 090) — a conversa na página da mesa.
 *
 * ## Não é o review de mestre, e os dois convivem (requisito 26)
 *
 * `gm_reviews.comment` (`db/types.ts:578`) é o campo de texto de uma
 * **avaliação com nota** — contrato próprio, confirmado em `routes/gm.ts:658`,
 * que a spec decidiu **não** migrar. Esta é a conversa pública da mesa: árvore,
 * respostas, voto e moderação global. Coisas diferentes, superfícies
 * diferentes; misturá-las apagaria a nota de um lado e a árvore do outro.
 *
 * ## O que este arquivo decide, e o que não decide
 *
 * Decide o que é **de domínio do `mesas`**: o rótulo do autor do conteúdo e
 * quais ações cada visitante enxerga. Não decide layout, acessibilidade nem
 * vocabulário da conversa — isso é do pacote, e duplicar aqui faria os três
 * consumidores divergirem (foi o que aconteceu entre `downloads` e `site` antes
 * da PR #264).
 */

/**
 * O rótulo do badge `content_author` é escolha do host, por `source_app`
 * (`contrato-http-v1.md` §2): `badge` é valor de máquina, e "autor do material"
 * mentiria num comentário de mesa.
 *
 * **"Quem publicou", e não "mestre":** a conta vinculada é a do publicador
 * (requisito 15b, decisão do mantenedor de 2026-07-27). Em mesa com
 * `publisher_role = 'announcer'` quem anunciou não é quem mestra, e chamar o
 * badge de "Mestre da mesa" seria falso justamente no caso que a decisão
 * nomeia.
 */
const CONTENT_AUTHOR_LABEL = 'Quem publicou a mesa';

export interface TableConversationProps {
  /** `tables.id` (UUID). O slug identifica a rota; o id identifica o assunto. */
  readonly tableId: string;
  /**
   * `false` em mesa encerrada, cancelada, arquivada ou importada expirada — a
   * conversa continua legível e não aceita fala nova (requisito 26a). O
   * servidor é a autoridade (`canWriteTableComments` no guard); isto só evita
   * oferecer um campo que sempre voltaria erro (heurística 5 de Nielsen).
   */
  readonly canComment?: boolean;
}

export function TableConversation({ tableId, canComment = true }: Readonly<TableConversationProps>) {
  const { user } = useSession();
  const { state, sort, changeSort, client, loadMore, reload } = useCommunityConversation({
    tableId,
    userId: user?.id,
  });

  /**
   * Permissões por comentário. O servidor continua sendo a autoridade — isto é
   * só o que a tela **oferece**, para não mostrar botão que sempre voltaria
   * erro.
   *
   * As regras saem do contrato, não da tela:
   * - só o autor edita e auto-retira (§4, `forbidden_not_author`);
   * - autor não vota no próprio comentário (decisão 5, `self_vote`);
   * - legado não edita nem vota (decisão 6, `legacy_immutable`);
   * - oculto/retirado não aceita ação (§7, `not_votable`);
   * - denunciar a si mesmo vira ruído na fila.
   *
   * `viewer_is_author` é o que torna as quatro primeiras verificáveis na tela:
   * vem do servidor como booleano derivado, porque §2 proíbe identificador no
   * payload público e a pergunta que a UI faz é "é meu?", não "de quem é".
   */
  const permissions = (comment: ConversationComment) => {
    if (!user) return {};

    const isLegacy = comment.legacy !== null;
    const isHidden = comment.state !== 'visible';
    const isMine = comment.viewer_is_author;
    // Os dois estados ocultos não são equivalentes para o autor (§4):
    // `pending_review_hidden` continua editável — é quando o corpo sumiu que o
    // autor mais precisa do caminho —, enquanto retirado não volta a ser
    // editável (`403`/`comment_removed`).
    const isRemoved = comment.state === 'removed';

    return {
      // Mesa fechada não aceita resposta nova, nem em fio já existente: 26a diz
      // "escrita nova bloqueada", e responder é escrita.
      reply: canComment && !isHidden,
      edit: canComment && isMine && !isLegacy && !isRemoved,
      withdraw: isMine && !isLegacy && !isRemoved,
      // **Voto congela; denúncia nunca.** As duas plataformas de referência
      // convergem nisso, e a distinção não é arbitrária:
      //
      // - Discourse, tópico arquivado: "Disable likes" e "Disable poll-based
      //   voting", mas "Continue to allow flagging of the topic or its posts".
      // - Reddit, post arquivado: voto trava no estado atual (não dá nem para
      //   retirar o próprio); o report continua.
      //
      // A razão é a diferença de natureza. Voto é sinal de ranking, e ranking
      // só faz sentido enquanto a conversa disputa atenção — mantê-lo aberto
      // deixa o placar de uma mesa morta continuar mudando por meses, o que
      // corrói a comparabilidade histórica e é exatamente o que "arquivar"
      // deveria impedir. Denúncia é segurança, e conteúdo abusivo não deixa de
      // ser abusivo porque a mesa acabou: travá-la criaria um recanto onde nada
      // pode ser reportado.
      //
      // Nota: o `accounts.` **não** recusa voto por assunto fechado — a rota
      // `PUT /internal/v1/comments/:id/vote` nem recebe `subject_authorization`
      // (`communityCommentRoutes.ts:221`), que só é exigida na escrita de fala.
      // Então esta regra vive aqui de propósito, e não duplica servidor.
      vote: canComment && !isMine && !isLegacy && !isHidden,
      report: !isMine && !isHidden,
    };
  };

  return (
    <section aria-labelledby="table-conversation-heading">
      <h2 id="table-conversation-heading">Comentários</h2>
      <CommentsConversation
        state={state}
        sort={sort}
        onSortChange={changeSort}
        client={client}
        canCreate={Boolean(user) && canComment}
        permissions={permissions}
        // Sem isto, a conversa anuncia "Comentário publicado." e continua
        // exibindo a árvore anterior: a resposta da mutação não entra no
        // `CommentsResource`, que só troca de dado ao reler. O comentário
        // recém-escrito some da tela até uma recarga externa — o pior sinal
        // possível logo depois de publicar, porque lê como fala perdida.
        onActionComplete={reload}
        onMoreLoaded={loadMore}
        contentAuthorLabel={CONTENT_AUTHOR_LABEL}
        emptyMessage={
          canComment
            ? user
              ? 'Ainda não há comentários. Seja a primeira pessoa a comentar.'
              : 'Ainda não há comentários. Entre com sua conta para comentar.'
            : 'Esta mesa foi encerrada e não recebe comentários novos.'
        }
      />
    </section>
  );
}
