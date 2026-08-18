import { MarkdownContent, ContentEditor } from '@artificio/content-editor';
import { sanitizeLegacyCommentHtml } from '@artificio/content-editor/sanitize';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { validateCommentBody } from './commentBody.js';
import {
  COMMENT_REPORT_REASONS,
  commentReportRequiresDetails,
  type CommentReportReason,
  type CommentSortUi,
  type CommentsConversationClient,
  type ConversationComment,
  type ConversationMoreNode,
  type CommentsThread,
} from './conversation.js';
import { normalizeCommentsError, type CommentsErrorShape } from './transport.js';
import type { CommentsResourceState } from './resource.js';

const SORT_LABELS: Record<CommentSortUi, string> = {
  best: 'Melhores',
  top: 'Mais votados',
  new: 'Recentes',
  old: 'Mais antigos',
};

const REPORT_REASON_LABELS: Record<CommentReportReason, string> = {
  malicious_link: 'Link malicioso',
  inappropriate_content: 'Conteúdo impróprio',
  spam_or_off_topic: 'Spam ou fora do assunto',
  harassment_or_hate: 'Assédio ou discurso de ódio',
  personal_data: 'Dados pessoais',
  copyright_violation: 'Violação de direito autoral',
  illegal_content: 'Conteúdo ilegal',
  other: 'Outro motivo',
};

export interface CommentViewerPermissions {
  readonly reply?: boolean;
  readonly edit?: boolean;
  readonly withdraw?: boolean;
  readonly vote?: boolean;
  readonly report?: boolean;
}

export type CommentsConversationSlot =
  | 'root'
  | 'toolbar'
  | 'thread'
  | 'comment'
  | 'author'
  | 'body'
  | 'actions'
  | 'composer'
  | 'status'
  | 'legacyLabel'
  | 'more';

export type CommentsConversationSlots = Partial<Record<CommentsConversationSlot, string>>;

export interface CommentsConversationProps {
  readonly state: CommentsResourceState<CommentsThread>;
  readonly sort: CommentSortUi;
  readonly onSortChange: (sort: CommentSortUi) => void;
  readonly client: CommentsConversationClient;
  readonly canCreate?: boolean;
  readonly permissions?: (comment: ConversationComment) => CommentViewerPermissions;
  readonly onActionComplete?: () => void | Promise<void>;
  readonly onMoreLoaded: (
    page: CommentsThread,
    request: ConversationMoreNode,
  ) => void | Promise<void>;
  readonly contentAuthorLabel?: string;
  readonly emptyMessage?: ReactNode;
  readonly className?: string;
  readonly slots?: CommentsConversationSlots;
}

type OpenPanel =
  | { readonly kind: 'reply' | 'edit' | 'report' | 'withdraw'; readonly commentId: string }
  | null;

function classes(base: string, extra?: string): string {
  return [base, extra].filter(Boolean).join(' ');
}

/*
 * Os dois `ContentEditor` desta tela são montados DE PROPÓSITO sem `maxLength`.
 *
 * `ContentEditor` compara `next.length` — unidades UTF-16 — enquanto
 * `validateCommentBody` conta pontos de código, para casar com `LENGTH()` do
 * PostgreSQL. Passar `COMMENT_BODY_MAX_LENGTH` ali bloquearia 5.001 emoji como
 * se fossem 10.002 caracteres, recusando no editor um corpo que o contrato
 * aceita. A validação no envio continua sendo a autoridade e devolve
 * `body_too_long` com o motivo verdadeiro (achado de review, PR #259).
 */
function visibleBody(bodyMarkdown: string): string | null {
  const validation = validateCommentBody(bodyMarkdown);
  return validation.ok ? validation.bodyMarkdown : null;
}

/**
 * Qual texto exibir, e por qual caminho ele chega.
 *
 * As duas metades do XOR do banco não são simétricas na leitura:
 *
 * - **Nativo** passa por `visibleBody`, que revalida a política corrente antes
 *   de renderizar.
 * - **Importado NÃO pode passar** por lá. `validateCommentBody` aplica a regra
 *   de links HTTPS-only do requisito 10a, posterior ao conteúdo legado; um
 *   `http://` de 2015 devolveria `null` e o comentário cairia em "Conteúdo
 *   indisponível.". Era esse o bug — sem corpo legado no payload, TODO
 *   comentário importado caía nesse placeholder.
 */
function commentBody(comment: ConversationComment, legacy: boolean): string | null {
  if (legacy) return comment.legacy?.content_html ?? null;
  if (comment.body_markdown === null) return null;
  return visibleBody(comment.body_markdown);
}

/**
 * Renderiza o corpo no formato que ele de fato tem.
 *
 * A coluna de corpo legado guarda **dois** formatos, distinguidos pela política
 * de sanitização gravada na importação: o `downloads` exporta markdown
 * (`content-editor/sanitizeUserMarkdown`), o `site` importará HTML
 * (`site-comment-html`). Mandar HTML pelo `MarkdownContent` exibiria `<p>` cru
 * ao leitor; mandar markdown pelo caminho HTML perderia a formatação.
 *
 * Os dois caminhos sanitizam na saída, que é a "defesa adicional na saída sem
 * regravar" de `spec.md:444`: `MarkdownContent` termina em `DOMPurify`
 * (`ContentEditor.tsx:21`) e o caminho HTML reaplica
 * `sanitizeLegacyCommentHtml`, idempotente por invariante testada
 * (`sanitize.test.ts:295-297`) — reaplicar não altera conteúdo já limpo, e
 * protege caso a linha tenha entrado por um importador anterior à política
 * corrente.
 */
function CommentBody({ value, format }: Readonly<{ value: string; format: 'markdown' | 'html' }>) {
  if (format === 'markdown') return <MarkdownContent value={value} />;
  return (
    <div
      className="artificio-markdown-content"
      // Sanitizado na própria expressão, mesma política que o limpou na
      // importação — mesmo padrão de `ContentEditor.tsx:33`, onde o HTML só
      // chega ao DOM depois de passar pelo sanitizador.
      dangerouslySetInnerHTML={{ __html: sanitizeLegacyCommentHtml(value) }}
    />
  );
}

function badgeLabel(
  badge: ConversationComment['author']['badge'],
  contentAuthorLabel: string,
): string | null {
  if (badge === 'admin') return 'Administrador';
  if (badge === 'moderator') return 'Moderador';
  if (badge === 'content_author') return contentAuthorLabel;
  return null;
}

function statePlaceholder(state: ConversationComment['state']): string {
  return state === 'pending_review_hidden'
    ? 'Comentário oculto enquanto aguarda revisão.'
    : 'Comentário retirado.';
}

/**
 * Texto genérico de propósito para erro vindo do servidor: `error.message` do
 * transporte carrega detalhe técnico (status, corpo, nome de operação) que não
 * serve a quem lê e pode vazar forma interna da API.
 *
 * A exceção é `localMessage`, preenchida SÓ por este componente quando ele
 * mesmo sabe o que aconteceu — hoje, a falha do recarregamento após uma escrita
 * bem-sucedida (achado de review, PR #273). Ali o texto fixo mentiria: dizer
 * "não foi possível concluir a ação" sobre um comentário que o servidor já
 * aceitou leva a pessoa a reenviar e duplicar.
 */
function errorMessage(error: (CommentsErrorShape & { localMessage?: string }) | null): string {
  if (!error) return 'Os comentários estão temporariamente indisponíveis.';
  if (error.localMessage) return error.localMessage;
  return error.retryable
    ? 'Não foi possível atualizar os comentários. Tente novamente.'
    : 'Não foi possível concluir a ação.';
}

export function CommentsConversation({
  state,
  sort,
  onSortChange,
  client,
  canCreate = false,
  permissions = () => ({}),
  onActionComplete,
  onMoreLoaded,
  contentAuthorLabel = 'Autor do conteúdo',
  emptyMessage = 'Ainda não há comentários.',
  className,
  slots = {},
}: Readonly<CommentsConversationProps>) {
  // Id por instância: duas conversas na mesma página (ex.: material e sua
  // errata) gerariam `id` duplicado, e o `htmlFor` do primeiro label passaria a
  // apontar para o select do segundo — leitor de tela anuncia o controle errado
  // (achado de review, PR #259).
  const sortControlId = useId();
  const [rootDraft, setRootDraft] = useState('');
  const [panel, setPanel] = useState<OpenPanel>(null);
  const [panelDraft, setPanelDraft] = useState('');
  const [reportReason, setReportReason] = useState<CommentReportReason>('spam_or_off_topic');
  const [reportDetails, setReportDetails] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // `localMessage` distingue erro VINDO do servidor (texto genérico) do aviso
  // que este componente produz sozinho — ver `errorMessage`.
  const [actionError, setActionError] = useState<(CommentsErrorShape & { localMessage?: string }) | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const panelContainerRef = useRef<HTMLDivElement>(null);
  const rootComposerRef = useRef<HTMLFormElement>(null);
  const rootSectionRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<{ action: NonNullable<OpenPanel>['kind']; commentId: string } | null>(null);

  const thread = state.data;
  const mutationsEnabled = state.status === 'fresh';

  useEffect(() => {
    if (!panel) return;
    const container = panelContainerRef.current;
    const editor = container?.querySelector<HTMLElement>('textarea, input, select, [contenteditable="true"]')
      ?? container?.querySelector<HTMLElement>('button');
    editor?.focus();
  }, [panel]);

  const restorePanelTriggerFocus = () => {
    const target = returnFocusRef.current;
    if (target === null) return;

    rootSectionRef.current
      ?.querySelector<HTMLElement>(
        `[data-comments-action="${target.action}"][data-comment-id="${target.commentId}"]`,
      )
      ?.focus();
    returnFocusRef.current = null;
  };

  // Alvo de foco pendente para a raiz. Um `queueMicrotask` disparado dentro de
  // `finishAction` corre ANTES de o React recomprometer a árvore, então ele
  // focava um `textarea` que a re-renderização seguinte descartava e o foco
  // caía no `body` (medido: `activeElement` = BODY após o envio). O efeito
  // abaixo roda depois do commit, quando o nó final já existe.
  const [focusRootAfterCommit, setFocusRootAfterCommit] = useState(0);

  useEffect(() => {
    if (panel === null && pendingAction === null) restorePanelTriggerFocus();
  }, [panel, pendingAction]);

  useEffect(() => {
    if (focusRootAfterCommit === 0) return;
    rootComposerRef.current?.querySelector<HTMLElement>('textarea')?.focus();
  }, [focusRootAfterCommit]);

  const closePanel = () => {
    setPanel(null);
  };

  const commentsByParent = useMemo(() => {
    const grouped = new Map<string | null, ConversationComment[]>();
    for (const comment of thread?.comments ?? []) {
      const siblings = grouped.get(comment.parent_id) ?? [];
      siblings.push(comment);
      grouped.set(comment.parent_id, siblings);
    }
    return grouped;
  }, [thread]);

  const moreByParent = useMemo(() => {
    const grouped = new Map<string | null, ConversationMoreNode[]>();
    for (const node of thread?.more ?? []) {
      const siblings = grouped.get(node.parent_id) ?? [];
      siblings.push(node);
      grouped.set(node.parent_id, siblings);
    }
    return grouped;
  }, [thread]);

  /**
   * `origin` é passado por quem dispara, não inferido de `panel !== null`
   * (achado de review, PR #262): enviar pelo compositor raiz **com um painel de
   * resposta aberto** fazia a origem ser lida como "painel", e o foco ia parar
   * no gatilho daquele painel — longe do lugar onde a pessoa estava digitando.
   * Quem enviou da raiz volta para a raiz; quem enviou de um painel volta para
   * o gatilho que o abriu.
   */
  const finishAction = async (message: string, origin: 'root' | 'panel'): Promise<void> => {
    // Descartar o alvo de retorno ANTES de fechar o painel: o efeito de
    // `restorePanelTriggerFocus` dispara quando `panel` vira `null` e, se o
    // alvo continuasse armado, ele sobrescreveria o foco que colocamos na
    // raiz logo abaixo — a origem seria respeitada por um instante e perdida
    // no efeito seguinte.
    if (origin === 'root') returnFocusRef.current = null;
    setPanel(null);
    setPanelDraft('');
    setReportDetails('');
    setAnnouncement(message);
    try {
      await onActionComplete?.();
    } finally {
      // `finally` e não depois do `await` (achado de review, PR #273):
      // `onActionComplete` é o recarregamento da thread, e ele PODE falhar
      // sozinho — a rede cai entre a escrita e o reload. Se o foco só voltasse
      // no caminho feliz, quem usa teclado ou leitor de tela ficaria com o foco
      // no nada exatamente no caso em que a tela também não atualizou.
      if (origin === 'root') setFocusRootAfterCommit((tick) => tick + 1);
    }
  };

  const runAction = async (
    key: string,
    action: () => Promise<unknown>,
    message: string,
    requiresFresh = true,
    origin: 'root' | 'panel' = 'panel',
  ) => {
    if ((requiresFresh && !mutationsEnabled) || pendingAction) return;
    setPendingAction(key);
    setActionError(null);
    setAnnouncement('');
    try {
      await action();
    } catch (error: unknown) {
      // Falhou: o painel FICA aberto com o texto preservado, de propósito — quem
      // escreveu não perde o que digitou por causa de um erro de rede ou de
      // permissão, e pode tentar de novo.
      //
      // Só que `finishAction` não pode ficar dentro do `try` junto com a ação
      // (defeito medido em beta, 2026-08-18): quando a escrita falhava, ela era
      // pulada pelo `catch` e o painel de EDIÇÃO permanecia aberto com o texto.
      // O segundo clique então chamava `client.edit` em vez de `client.create`,
      // e o usuário atualizava um comentário achando que estava publicando um
      // novo. Foi o que o `403` do `downloads` produziu — sem o escopo
      // `comment.write`, toda tentativa falhava e o texto nunca saía da caixa.
      setActionError(normalizeCommentsError(error).toJSON());
      setPendingAction(null);
      return;
    }
    // Fora do `try`: sucesso é a ÚNICA condição que fecha o painel e limpa o
    // rascunho. Um erro dentro de `finishAction` (foco, anúncio) não pode ser
    // confundido com falha da escrita — a escrita já aconteceu.
    try {
      await finishAction(message, origin);
    } catch {
      // A rejeição aqui vem do recarregamento da thread, NUNCA da escrita — ela
      // já foi confirmada pelo servidor no `await action()` acima. Todo chamador
      // usa `void runAction(...)`, então sem este `catch` a falha virava
      // unhandled rejection: a pessoa via o comentário sumir da tela sem
      // nenhuma explicação (achado de review, PR #273).
      //
      // O texto é deliberadamente um AVISO de atualização, não um erro de
      // envio: dizer "não foi possível publicar" faria a pessoa reenviar e
      // duplicar o comentário — a mesma classe de dano que o defeito do painel
      // armado causou em beta.
      // `retryable: false` não é detalhe: a escrita foi bem-sucedida, então
      // repetir a ação duplicaria o comentário.
      setActionError({
        code: 'unavailable',
        message: 'reload após escrita confirmada falhou',
        retryable: false,
        localMessage: `${message} Não foi possível atualizar a lista — recarregue a página para vê-lo.`,
      });
    } finally {
      setPendingAction(null);
    }
  };

  const openPanel = (
    next: NonNullable<OpenPanel>,
    initialValue = '',
  ) => {
    returnFocusRef.current = { action: next.kind, commentId: next.commentId };
    setPanel(next);
    setPanelDraft(initialValue);
    setActionError(null);
    setAnnouncement('');
  };

  const submitRoot = (event: FormEvent) => {
    event.preventDefault();
    void runAction('create', async () => {
      await client.create(rootDraft);
      setRootDraft('');
    }, 'Comentário publicado.', true, 'root');
  };

  const submitPanel = (event: FormEvent, comment: ConversationComment) => {
    event.preventDefault();
    if (!panel || panel.commentId !== comment.id) return;
    if (panel.kind === 'reply') {
      void runAction(`reply:${comment.id}`, () => client.reply(comment.id, panelDraft), 'Resposta publicada.');
    } else if (panel.kind === 'edit') {
      void runAction(`edit:${comment.id}`, () => client.edit(comment.id, panelDraft), 'Comentário editado.');
    } else if (panel.kind === 'report') {
      void runAction(
        `report:${comment.id}`,
        () => client.report(comment.id, reportReason, reportDetails.trim() || undefined),
        'Denúncia enviada para análise.',
      );
    }
  };

  const renderPanel = (comment: ConversationComment) => {
    if (!panel || panel.commentId !== comment.id) return null;

    if (panel.kind === 'withdraw') {
      return (
        <div ref={panelContainerRef} className="artificio-comments__confirm" data-comments-slot="withdraw-confirmation">
          <p>Retirar este comentário? A conversa e as respostas serão preservadas.</p>
          <button
            type="button"
            disabled={!mutationsEnabled || pendingAction !== null}
            onClick={() => void runAction(
              `withdraw:${comment.id}`,
              () => client.withdraw(comment.id),
              'Comentário retirado.',
            )}
          >
            Confirmar retirada
          </button>
          <button type="button" onClick={closePanel}>Cancelar</button>
        </div>
      );
    }

    if (panel.kind === 'report') {
      const detailsRequired = commentReportRequiresDetails(reportReason);
      return (
        <div ref={panelContainerRef}>
        <form className="artificio-comments__form" onSubmit={(event) => submitPanel(event, comment)}>
          <label htmlFor={`comments-report-reason-${comment.id}`}>Motivo da denúncia</label>
          <select
            id={`comments-report-reason-${comment.id}`}
            value={reportReason}
            disabled={!mutationsEnabled || pendingAction !== null}
            onChange={(event) => setReportReason(event.target.value as CommentReportReason)}
          >
            {COMMENT_REPORT_REASONS.map((reason) => (
              <option key={reason} value={reason}>{REPORT_REASON_LABELS[reason]}</option>
            ))}
          </select>
          <label htmlFor={`comments-report-details-${comment.id}`}>
            {detailsRequired ? 'Detalhes (obrigatórios para este motivo)' : 'Detalhes (opcionais)'}
          </label>
          <textarea
            id={`comments-report-details-${comment.id}`}
            value={reportDetails}
            maxLength={4_000}
            required={detailsRequired}
            aria-required={detailsRequired}
            disabled={!mutationsEnabled || pendingAction !== null}
            onChange={(event) => setReportDetails(event.target.value)}
          />
          <div className="artificio-comments__form-actions">
            {/*
              Botão travado enquanto o motivo exige detalhe e o campo está vazio:
              deixá-lo operável só entregaria `422`/`details_required` depois do
              envio, sem dizer o que faltou.
            */}
            <button
              type="submit"
              disabled={!mutationsEnabled || pendingAction !== null || (detailsRequired && reportDetails.trim() === '')}
            >Enviar denúncia</button>
            <button type="button" onClick={closePanel}>Cancelar</button>
          </div>
        </form>
        </div>
      );
    }

    const label = panel.kind === 'reply'
      ? `Resposta a ${comment.author.display_name ?? 'comentário'}`
      : 'Editar comentário';
    return (
      <div ref={panelContainerRef}>
      <form className="artificio-comments__form" onSubmit={(event) => submitPanel(event, comment)}>
        <ContentEditor
          value={panelDraft}
          onChange={setPanelDraft}
          label={label}
          required
          disabled={!mutationsEnabled || pendingAction !== null}
        />
        <div className="artificio-comments__form-actions">
          <button type="submit" disabled={!mutationsEnabled || pendingAction !== null}>
            {panel.kind === 'reply' ? 'Publicar resposta' : 'Salvar edição'}
          </button>
          <button type="button" onClick={closePanel}>Cancelar</button>
        </div>
      </form>
      </div>
    );
  };

  const renderComment = (comment: ConversationComment): ReactNode => {
    const commentPermissions = permissions(comment);
    const legacy = comment.legacy !== null || comment.author.state === 'legacy';
    const authorName = legacy
      ? comment.legacy?.author_name ?? comment.author.display_name ?? 'Autoria não informada'
      : comment.author.display_name ?? 'Conta excluída';
    const label = legacy ? null : badgeLabel(comment.author.badge, contentAuthorLabel);
    const body = commentBody(comment, legacy);
    const canAct = mutationsEnabled && pendingAction === null;

    return (
      <li
        key={comment.id}
        className={classes('artificio-comments__comment', slots.comment)}
        data-comments-slot="comment"
        data-comment-depth={comment.depth}
      >
        <article aria-labelledby={`comment-author-${comment.id}`}>
          <header className={classes('artificio-comments__author', slots.author)} data-comments-slot="author">
            {!legacy && comment.author.avatar_url && (
              <img
                className="artificio-comments__avatar"
                src={comment.author.avatar_url}
                alt=""
                width="32"
                height="32"
                referrerPolicy="no-referrer"
              />
            )}
            <strong id={`comment-author-${comment.id}`}>{authorName}</strong>
            {label && <span className="artificio-comments__badge">{label}</span>}
            {legacy && (
              <span className={classes('artificio-comments__legacy-label', slots.legacyLabel)}>
                comentário importado — autoria não verificada
              </span>
            )}
            <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('pt-BR')}</time>
            {comment.edited_at && <span className="artificio-comments__edited">editado</span>}
          </header>

          <div className={classes('artificio-comments__body', slots.body)} data-comments-slot="body">
            {comment.state === 'visible' && body
              ? <CommentBody value={body} format={legacy ? comment.legacy?.format ?? 'html' : 'markdown'} />
              : <p>{comment.state === 'visible' ? 'Conteúdo indisponível.' : statePlaceholder(comment.state)}</p>}
          </div>

          <div className={classes('artificio-comments__actions', slots.actions)} data-comments-slot="actions">
            {comment.state === 'visible' && comment.score !== null && (
              <span className="artificio-comments__score" aria-label={`Pontuação: ${comment.score}`}>
                {comment.score}
              </span>
            )}
            {commentPermissions.vote && !legacy && comment.state === 'visible' && (
              <>
                <button
                  type="button"
                  aria-label={`Votar positivamente no comentário de ${authorName}`}
                  aria-pressed={comment.my_vote === 1}
                  disabled={!canAct}
                  onClick={() => void runAction(
                    `vote-up:${comment.id}`,
                    () => client.vote(comment.id, comment.my_vote === 1 ? 0 : 1),
                    'Voto atualizado.',
                  )}
                >▲</button>
                <button
                  type="button"
                  aria-label={`Votar negativamente no comentário de ${authorName}`}
                  aria-pressed={comment.my_vote === -1}
                  disabled={!canAct}
                  onClick={() => void runAction(
                    `vote-down:${comment.id}`,
                    () => client.vote(comment.id, comment.my_vote === -1 ? 0 : -1),
                    'Voto atualizado.',
                  )}
                >▼</button>
              </>
            )}
            {commentPermissions.reply && comment.depth < 4 && (
              <button
                type="button"
                data-comments-action="reply"
                data-comment-id={comment.id}
                disabled={!canAct}
                onClick={() => openPanel({ kind: 'reply', commentId: comment.id })}
              >
                Responder a {authorName}
              </button>
            )}
            {commentPermissions.edit && !legacy && comment.state === 'visible' && body && (
              <button
                type="button"
                data-comments-action="edit"
                data-comment-id={comment.id}
                disabled={!canAct}
                onClick={() => openPanel({ kind: 'edit', commentId: comment.id }, body)}
              >Editar</button>
            )}
            {commentPermissions.withdraw && !legacy && comment.state === 'visible' && (
              <button
                type="button"
                data-comments-action="withdraw"
                data-comment-id={comment.id}
                disabled={!canAct}
                onClick={() => openPanel({ kind: 'withdraw', commentId: comment.id })}
              >Retirar</button>
            )}
            {commentPermissions.report && !legacy && comment.state === 'visible' && (
              <button
                type="button"
                data-comments-action="report"
                data-comment-id={comment.id}
                disabled={!canAct}
                onClick={() => openPanel({ kind: 'report', commentId: comment.id })}
              >Denunciar</button>
            )}
          </div>

          {renderPanel(comment)}
        </article>
        {renderBranch(comment.id)}
      </li>
    );
  };

  const renderMore = (node: ConversationMoreNode): ReactNode => (
    <li key={node.cursor} className={classes('artificio-comments__more', slots.more)} data-comments-slot="more">
      <button
        type="button"
        disabled={pendingAction !== null}
        onClick={() => void runAction(
          `more:${node.cursor}`,
          async () => onMoreLoaded(await client.read(sort, node.cursor), node),
          'Mais comentários carregados.',
          false,
        )}
      >
        Mostrar mais {node.count} {node.count === 1 ? 'comentário' : 'comentários'}
      </button>
    </li>
  );

  function renderBranch(parentId: string | null): ReactNode {
    const comments = commentsByParent.get(parentId) ?? [];
    const more = moreByParent.get(parentId) ?? [];
    if (comments.length === 0 && more.length === 0) return null;
    return (
      <ol className={classes('artificio-comments__thread', slots.thread)} data-comments-slot="thread">
        {comments.map(renderComment)}
        {more.map(renderMore)}
      </ol>
    );
  }

  return (
    <section ref={rootSectionRef} className={classes('artificio-comments', classes(slots.root ?? '', className))}>
      <div className={classes('artificio-comments__toolbar', slots.toolbar)} data-comments-slot="toolbar">
        <label htmlFor={sortControlId}>Ordenar comentários</label>
        <select
          id={sortControlId}
          value={sort}
          onChange={(event) => onSortChange(event.target.value as CommentSortUi)}
        >
          {(Object.keys(SORT_LABELS) as CommentSortUi[]).map((value) => (
            <option key={value} value={value}>{SORT_LABELS[value]}</option>
          ))}
        </select>
      </div>

      {state.status !== 'fresh' && (
        <p
          className={classes('artificio-comments__status', slots.status)}
          data-comments-state={state.status}
          role={state.status === 'unavailable' ? 'alert' : 'status'}
        >
          {state.status === 'stale'
            ? `Exibindo a última leitura disponível, de ${Math.ceil(state.ageMs / 1_000)} segundos atrás.`
            : errorMessage(state.error)}
        </p>
      )}

      {/*
        Regiões live montadas sempre, com o texto variando. Montar o container
        junto com a mensagem faz o leitor de tela perder o anúncio: ele observa
        mutação DENTRO de uma região que já existia, e um nó inserido do zero
        frequentemente não dispara nada (achado de review, PR #259).
      */}
      <p className="artificio-comments__status" role="alert">
        {actionError ? errorMessage(actionError) : ''}
      </p>
      {/*
        `<output>` em vez de `<p role="status">`: o papel é implícito no elemento
        nativo e o suporte em leitor de tela é mais consistente (achado Sonar).
      */}
      <output className="artificio-comments__status">
        {announcement ?? ''}
      </output>

      {canCreate && (
        <form
          ref={rootComposerRef}
          className={classes('artificio-comments__composer', slots.composer)}
          data-comments-slot="composer"
          onSubmit={submitRoot}
        >
          <ContentEditor
            value={rootDraft}
            onChange={setRootDraft}
            label="Novo comentário"
            required
            disabled={!mutationsEnabled || pendingAction !== null}
          />
          <button type="submit" disabled={!mutationsEnabled || pendingAction !== null}>Publicar comentário</button>
        </form>
      )}

      {thread && thread.comments.length === 0 && thread.more.length === 0
        ? <p className="artificio-comments__empty">{emptyMessage}</p>
        : renderBranch(null)}
    </section>
  );
}
