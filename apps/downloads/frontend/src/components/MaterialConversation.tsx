import { useSession } from '@artificio/auth/client';
import { CommentsConversation, resolveViewerPermissions } from '@artificio/comments/react';
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
  const { state, sort, changeSort, client, loadMore, reload } = useCommunityConversation({
    materialId,
    userId: user?.id,
  });

  /**
   * Permissões por comentário — política compartilhada do pacote
   * (`viewerPermissions.ts`), onde as regras e o porquê de cada uma vivem em um
   * lugar só. Era uma cópia local aqui, idêntica à do `site` e à do `mesas`.
   *
   * O `downloads` não fecha assunto: material publicado aceita comentário
   * enquanto estiver visível, e os estados que o fecham (`withdrawn`,
   * `rejected`) já chegam como `state !== 'visible'`. Por isso
   * `subjectAcceptsWrites` fica no default `true`.
   */
  const permissions = resolveViewerPermissions({ viewer: user });

  return (
    <section aria-labelledby="material-conversation-heading" className="mt-8">
      {/* Mesma escala da `RatingSection`, irmã direta na `MaterialPage`. Sem
          classe o título saía do tamanho do corpo do texto, sem hierarquia
          (auditoria de 2026-08-17, spec 090). */}
      <h2 id="material-conversation-heading" className="text-lg font-semibold text-[var(--fg)]">
        Comentários
      </h2>
      <CommentsConversation
        state={state}
        sort={sort}
        onSortChange={changeSort}
        client={client}
        canCreate={Boolean(user)}
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
          user
            ? 'Ainda não há comentários. Seja a primeira pessoa a comentar.'
            : 'Ainda não há comentários. Entre com sua conta para comentar.'
        }
      />
    </section>
  );
}
