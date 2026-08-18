import type { ConversationComment } from './conversation.js';

/**
 * Papel global do `accounts.`, **estruturalmente compatível** com `UserRole` de
 * `@artificio/auth` (`types.ts:1`), reafirmado aqui em vez de importado.
 *
 * O `comments` não depende de `@artificio/auth` hoje, e criar essa aresta para
 * um alias de três literais acoplaria o pacote de comentários ao pacote de
 * autenticação — que tem trava própria de mudança (`AGENTS.md`: "auth é sagrado,
 * nunca quebrar a sessão compartilhada"). O tipo é estrutural, então o `User`
 * do `auth` satisfaz este contrato sem conversão, e o teste
 * `viewerPermissions.test.ts` fixa a equivalência: se `UserRole` ganhar um papel
 * novo, ele falha e obriga a revisar esta linha.
 */
export type CommentModerationRole = 'user' | 'moderator' | 'admin';

/**
 * Política de capacidades da conversa — **uma só, para os três apps**.
 *
 * ## Por que ela subiu para o pacote
 *
 * Até aqui `site`, `mesas` e `downloads` tinham cada um a sua cópia da mesma
 * função `permissions`, e as três divergiram do backend **em conjunto**: nenhuma
 * oferecia remoção de moderador, embora
 * `POST /api/v1/community/moderation/comments/:id/removal` já existisse em
 * `mesas/routes/communityModeration.ts:160` e em
 * `downloads/routes/communityModeration.ts:116` desde a fase 7. Admin e
 * moderador viam a conversa exatamente como um visitante logado — sem botão,
 * sem erro, sem nada (relato do mantenedor, 2026-08-18).
 *
 * Regra pétrea do monorepo: divergência por app é dívida, e a correção pertence
 * ao contrato compartilhado, "onde vale para todos, inclusive para o próximo app
 * que ainda não existe" (`AGENTS.md` §Compartilhado por padrão). Por isso o que
 * varia entre os apps entra como **parâmetro de ambiente**, nunca como cópia.
 *
 * ## O que de fato varia
 *
 * Só `subjectAcceptsWrites`. O `mesas` fecha fala nova quando a mesa encerra,
 * cancela ou arquiva (requisito 26a — "escrita nova bloqueada"); `site` e
 * `downloads` não têm essa categoria e passam o default `true`. Todo o resto era
 * idêntico nas três cópias, palavra por palavra.
 */
export interface ViewerPermissionsInput {
  /** Sessão do `accounts.`; `null`/`undefined` quando ninguém está logado. */
  readonly viewer: { readonly role?: CommentModerationRole } | null | undefined;
  /**
   * O assunto ainda aceita escrita nova? Mesa encerrada/arquivada devolve
   * `false` e fecha resposta, edição e voto — nunca denúncia nem moderação.
   */
  readonly subjectAcceptsWrites?: boolean;
}

export interface CommentViewerPermissions {
  readonly reply?: boolean;
  readonly edit?: boolean;
  readonly withdraw?: boolean;
  readonly vote?: boolean;
  readonly report?: boolean;
  /**
   * Retirar comentário **alheio** como moderador global. Distinta de `withdraw`
   * de propósito: aquela é auto-retirada do autor e não pede motivo; esta é ação
   * de moderação, exige `reason` no corpo da requisição e é registrada no log.
   */
  readonly moderateRemove?: boolean;
  /**
   * Restaurar comentário retirado. Par exato de `moderateRemove`: sem ela, a
   * retirada é ação de mão única — um clique errado só se desfaz pela fila de
   * moderação, que hoje existe no `downloads` e em mais nenhum app.
   */
  readonly moderateRestore?: boolean;
}

/**
 * Moderação de comentário vem do papel **global** do `accounts.`, nunca do papel
 * local do app.
 *
 * Isto espelha exatamente o guard do servidor: `requireCommentModerator`
 * (`communityModeration.ts:48-55`) lê `globalRole` e não `role`, porque o
 * `mesas` rebaixa `moderator` para `player` em `resolveEffectiveMesasRole` — de
 * propósito, já que moderar comentário não é capacidade de domínio (gerir mesa,
 * sistema, catálogo). Ler o papel local aqui esconderia o botão justamente de
 * quem o servidor autoriza.
 */
export function canModerateComments(role: CommentModerationRole | undefined): boolean {
  return role === 'moderator' || role === 'admin';
}

/**
 * As regras saem do contrato, não da tela — a UI só **oferece** o que o servidor
 * aceitaria, para não exibir botão que sempre voltaria erro (heurística 5 de
 * Nielsen: prevenir em vez de reportar):
 *
 * - só o autor edita e auto-retira (§4, `forbidden_not_author`);
 * - autor não vota no próprio comentário (decisão 5, `self_vote`);
 * - legado não edita nem vota (decisão 6, `legacy_immutable`);
 * - oculto/retirado não aceita ação (§7, `not_votable`);
 * - denunciar a si mesmo vira ruído na fila.
 *
 * `viewer_is_author` é o que torna as quatro primeiras verificáveis na tela: vem
 * do servidor como booleano derivado, porque §2 proíbe identificador no payload
 * público e a pergunta que a UI faz é "é meu?", não "de quem é".
 */
export function resolveViewerPermissions(
  { viewer, subjectAcceptsWrites = true }: ViewerPermissionsInput,
) {
  return (comment: ConversationComment): CommentViewerPermissions => {
    if (!viewer) return {};

    const isLegacy = comment.legacy !== null;
    const isHidden = comment.state !== 'visible';
    const isMine = comment.viewer_is_author;
    // Os dois estados ocultos não são equivalentes para o autor (§4):
    // `pending_review_hidden` continua editável — é quando o corpo sumiu que o
    // autor mais precisa do caminho —, enquanto retirado não volta a ser
    // editável (`403`/`comment_removed`).
    const isRemoved = comment.state === 'removed';
    const moderator = canModerateComments(viewer.role);

    return {
      reply: subjectAcceptsWrites && !isHidden,
      edit: subjectAcceptsWrites && isMine && !isLegacy && !isRemoved,
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
      vote: subjectAcceptsWrites && !isMine && !isLegacy && !isHidden,
      report: !isMine && !isHidden,
      // Mesma razão pela qual a denúncia sobrevive ao fechamento: retirar
      // conteúdo abusivo é segurança, e não depende de o assunto ainda aceitar
      // fala nova — por isso `subjectAcceptsWrites` não entra aqui.
      //
      // `!isMine` porque o autor já tem `withdraw`, que é o caminho certo para
      // ele: não pede motivo e não vira registro de moderação contra si mesmo.
      // `!isRemoved` porque retirar o que já está retirado é ruído; restaurar é
      // outra ação, e vive na fila de moderação.
      //
      // **`isLegacy` NÃO entra aqui, e a ausência é deliberada.** A
      // imutabilidade do legado (decisão 6) é sobre quem não pode agir sobre a
      // própria fala importada: edição, voto e auto-retirada dependem de haver
      // um autor perante o sistema, e o legado tem `community_actor_id` nulo
      // por construção. Moderação não depende disso — depende de haver
      // conteúdo no ar. O backend diz isso literalmente: `removeCommentByModerator`
      // existe para "conteúdo que a moderação encontra navegando — ou que o
      // legado importou" (`communityModerationCase.ts:792-793`), e recusa
      // apenas por `visibility_state`, nunca por origem.
      //
      // Como nasceu: `!isLegacy` foi copiado da linha de `withdraw` logo acima,
      // onde ele é correto. O efeito era um comentário importado abusivo
      // permanentemente irremovível pela conversa nos três apps — o acervo do
      // `site` são 25 falas do WordPress sem conta por trás, exatamente o
      // conteúdo mais provável de precisar de moderação e menos provável de ser
      // retirado pelo autor (achado de review, PR #274).
      moderateRemove: moderator && !isMine && !isRemoved,
      // Espelho de `moderateRemove`, com `isRemoved` invertido: os dois nunca
      // aparecem juntos, e juntos cobrem os dois estados possíveis do alvo.
      //
      // `pending_review_hidden` fica de fora de propósito — está oculto
      // aguardando revisão, não retirado por decisão; "restaurar" ali daria a
      // um clique o poder de aprovar o que a fila ainda não julgou.
      //
      // **Esta linha é condição NECESSÁRIA, não suficiente.** O payload público
      // colapsa `author_removed` e `moderator_removed` no mesmo `removed`
      // (`communityCommentRead.ts:601-605`), de propósito: dizer ao leitor "o
      // autor apagou" versus "um moderador apagou" entrega um julgamento que
      // `contrato-http-v1.md` §2 não autoriza. Mas `restoreCommentByModerator`
      // recusa `author_removed` com `409 comment_removed_by_author`
      // (`communityModerationCase.ts:903-909`) — a auto-retirada é irreversível
      // para a moderação (decisão 17).
      //
      // Então daqui não dá para saber se a restauração é possível: a informação
      // que falta não está no payload. Quem fecha é `CommentsConversation`, que
      // viu a retirada acontecer (ver `moderatorRemovedIds` lá) e restringe
      // esta capacidade ao que ele mesmo retirou. Sem esse filtro o botão
      // aparecia sobre toda auto-retirada alheia e falhava sempre — achado de
      // review, PR #274.
      //
      // Quando o `accounts.` expuser uma capacidade derivada no payload (padrão
      // de `viewer_is_author`: responde "posso?" sem dizer "de quem é"), ela é
      // lida AQUI e o filtro do componente sai — voltando a existir um dono só.
      moderateRestore: moderator && !isMine && isRemoved,
    };
  };
}
