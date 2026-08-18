import { useSession } from '@artificio/auth/client';
import { CommentsConversation, resolveViewerPermissions } from '@artificio/comments/react';
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

/**
 * Mensagem da conversa sem nenhum comentário.
 *
 * Função nomeada em vez de ternário aninhado no JSX (achado do Sonar, PR #268):
 * são três estados com causas distintas — mesa aberta e visitante anônimo,
 * mesa aberta e sessão ativa, mesa encerrada — e aninhar as condições escondia
 * qual delas produz cada frase. A ordem importa: encerrada vence, porque não
 * adianta convidar a entrar numa conversa que não aceita fala nova
 * (heurística 1 de Nielsen — o sistema diz o estado real).
 */
function mensagemDeConversaVazia(podeComentar: boolean, temSessao: boolean): string {
  if (!podeComentar) return 'Esta mesa foi encerrada e não recebe comentários novos.';
  if (temSessao) return 'Ainda não há comentários. Seja a primeira pessoa a comentar.';
  return 'Ainda não há comentários. Entre com sua conta para comentar.';
}

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
   * Permissões por comentário — política compartilhada do pacote
   * (`viewerPermissions.ts`), onde as regras e o porquê de cada uma vivem em um
   * lugar só. Era uma cópia local aqui, idêntica à do `site` e à do `downloads`.
   *
   * `canComment` é a ÚNICA coisa que o `mesas` tem a mais, e é exatamente o que
   * o parâmetro de ambiente existe para carregar: mesa encerrada, cancelada ou
   * arquivada bloqueia escrita nova (requisito 26a), então resposta, edição e
   * voto fecham junto com ela. Denúncia e retirada por moderação **não** —
   * conteúdo abusivo não deixa de ser abusivo porque a mesa acabou.
   */
  const permissions = resolveViewerPermissions({
    viewer: user,
    subjectAcceptsWrites: canComment,
  });

  return (
    <section aria-labelledby="table-conversation-heading" className="mt-8">
      {/* Mesma escala dos outros títulos de seção da página (`MesaPage:287`).
          Sem classe, o `h2` renderizava a 16px — do tamanho do corpo do texto,
          sem nada que o marcasse como cabeçalho (auditoria de 2026-08-17).
          A cor é `--fg`, e não o `text-slate-100` que o vizinho usa: o app tem
          tema claro (108 regras `[data-theme="light"]` no `index.css`) e o
          slate fixo não vira, ficando quase branco sobre fundo claro. `--fg` é
          o padrão dominante aqui — 48 usos contra 3 do slate. */}
      <h2 id="table-conversation-heading" className="text-lg font-bold mb-2 text-[var(--fg)]">
        Comentários
      </h2>
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
        emptyMessage={mensagemDeConversaVazia(canComment, Boolean(user))}
      />
    </section>
  );
}
