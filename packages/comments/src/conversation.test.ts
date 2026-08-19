import { describe, expect, it } from 'vitest';

import {
  commentsThreadSchema,
  createCommentOperation,
  createCommentReportOperation,
  createCommentsConversationClient,
  setCommentVoteOperation,
  mergeCommentsThreadPage,
} from './conversation.js';
import { createCommentsClient } from './transport.js';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Captura o que cada mutação manda ao transporte.
 *
 * A resposta é um duplo permissivo: o que está sob teste é a chave que **sai**,
 * não o parse do que volta — por isso as asserções olham só `recebidas`.
 */
function clientEspiao() {
  const recebidas: (string | undefined)[] = [];
  const client = createCommentsClient({
    transport: {
      execute: async (request) => {
        recebidas.push(request.idempotencyKey);
        // Lança de propósito: montar uma resposta válida para cada operação
        // custaria fixtures que não acrescentam nada — a chave já foi capturada
        // e o parse da resposta é assunto de outra suíte.
        throw new Error('resposta não importa neste teste');
      },
    },
  });
  return {
    recebidas,
    conversation: createCommentsConversationClient(client, {
      subjectType: 'downloads.material',
      subjectId: 'material-1',
    }),
  };
}

/**
 * O `accounts.` recusa criação, resposta, edição e denúncia sem
 * `Idempotency-Key` no formato `[\x20-\x7E]{8,128}`
 * (`communityCommentRoutes.ts:338-342`, `communityModerationRoutes.ts:125-132`).
 * Enquanto o client da conversa não gerava a chave, TODA escrita da conversa
 * nova voltava `400 invalid_idempotency_key` — publicar, responder e editar
 * ficavam impossíveis nos três consumidores, e a UI só anunciava a falha.
 */
describe('resposta das mutações', () => {
  /**
   * Payload REAL do `accounts.` na escrita, campo a campo: `CreatedComment`
   * (`communityCommentWrite.ts:106`) e `EditedComment`
   * (`communityCommentLifecycle.ts:111`). Placar, autor, `state`, `my_vote` e
   * `legacy` não existem aqui — dependem de joins que só a leitura da árvore
   * faz.
   */
  const respostaDoServidor = (comEdicao: boolean) => ({
    id: ROOT_ID,
    parent_id: null,
    root_id: ROOT_ID,
    depth: 0,
    body_markdown: 'olá',
    created_at: '2026-08-16T00:00:00.000Z',
    ...(comEdicao ? { edited_at: '2026-08-16T01:00:00.000Z' } : {}),
  });

  function clientComResposta(resposta: unknown) {
    const client = createCommentsClient({
      transport: { execute: async () => resposta },
    });
    return createCommentsConversationClient(client, {
      subjectType: 'downloads.material',
      subjectId: 'material-1',
    });
  }

  it.each([
    ['create', false, (c: ReturnType<typeof clientComResposta>) => c.create('olá')],
    ['reply', false, (c: ReturnType<typeof clientComResposta>) => c.reply(ROOT_ID, 'olá')],
    ['edit', true, (c: ReturnType<typeof clientComResposta>) => c.edit(ROOT_ID, 'olá')],
  ])('%s aceita o payload que o servidor devolve de fato', async (_label, comEdicao, acao) => {
    // Antes do alinhamento, as três declaravam `conversationCommentSchema` e
    // esta resposta falhava em 8 campos: escrita já persistida virava
    // `schema_incompatible`, a UI mostrava erro, o reload não rodava, e o
    // reenvio gerava chave nova — duplicando a fala já gravada.
    const resultado = await acao(clientComResposta(respostaDoServidor(comEdicao)));

    expect(resultado).toMatchObject({ id: ROOT_ID, body_markdown: 'olá' });
  });
});

describe('chave de idempotência nas mutações', () => {
  it.each([
    ['create', (c: ReturnType<typeof clientEspiao>['conversation']) => c.create('olá')],
    ['reply', (c: ReturnType<typeof clientEspiao>['conversation']) => c.reply(ROOT_ID, 'olá')],
    ['edit', (c: ReturnType<typeof clientEspiao>['conversation']) => c.edit(ROOT_ID, 'olá')],
    ['report', (c: ReturnType<typeof clientEspiao>['conversation']) => c.report(ROOT_ID, 'spam_or_off_topic')],
  ])('%s manda chave no formato que o accounts. aceita', async (_label, acao) => {
    const { recebidas, conversation } = clientEspiao();

    await acao(conversation).catch(() => undefined);

    expect(recebidas).toHaveLength(1);
    expect(recebidas[0]).toMatch(/^[\x20-\x7E]{8,128}$/);
  });

  it('gera chave nova a cada tentativa, para dois envios não colidirem', async () => {
    const { recebidas, conversation } = clientEspiao();

    await conversation.create('primeira').catch(() => undefined);
    await conversation.create('segunda').catch(() => undefined);

    expect(recebidas[0]).not.toBe(recebidas[1]);
  });

  it('respeita a chave do chamador, para a retentativa do mesmo envio não duplicar', async () => {
    const { recebidas, conversation } = clientEspiao();
    const chave = 'envio-formulario-0001';

    await conversation.create('texto', undefined, chave).catch(() => undefined);
    await conversation.create('texto', undefined, chave).catch(() => undefined);

    expect(recebidas).toEqual([chave, chave]);
  });

  it('não manda chave em withdraw nem vote, que não passam por essa validação', async () => {
    const { recebidas, conversation } = clientEspiao();

    await conversation.withdraw(ROOT_ID).catch(() => undefined);
    await conversation.vote(ROOT_ID, 1).catch(() => undefined);

    expect(recebidas).toEqual([undefined, undefined]);
  });
});

describe('contrato da conversa', () => {
  it('normaliza a árvore HTTP e rebaixa imagem para link antes da UI', () => {
    const thread = commentsThreadSchema.parse({
      state: 'fresh',
      snapshot_revision: 3,
      comments: [{
        id: ROOT_ID,
        parent_id: null,
        root_id: ROOT_ID,
        depth: 0,
        body_markdown: '![mapa](https://evil.example/rastreio.png)',
        created_at: '2026-08-13T10:00:00.000Z',
        edited_at: null,
        state: 'visible',
        author: {
          display_name: 'Ana',
          avatar_url: null,
          badge: null,
          state: 'active',
        },
        upvotes: 0,
        downvotes: 0,
        score: 0,
        my_vote: 0,
        legacy: null,
      }],
      more: [],
      truncated: false,
    });

    expect(thread.comments[0]?.body_markdown).toBe(
      '[mapa — abrir imagem externa](https://evil.example/rastreio.png)',
    );
  });

  it('recusa legado que sugere avatar ou badge de conta verificada', () => {
    const result = commentsThreadSchema.safeParse({
      state: 'fresh',
      snapshot_revision: 1,
      comments: [{
        id: ROOT_ID,
        parent_id: null,
        root_id: ROOT_ID,
        depth: 0,
        body_markdown: 'Texto legado',
        created_at: '2026-08-13T10:00:00.000Z',
        edited_at: null,
        state: 'visible',
        author: {
          display_name: 'Autor antigo',
          avatar_url: 'https://example.com/avatar.png',
          badge: 'content_author',
          state: 'legacy',
        },
        upvotes: 0,
        downvotes: 0,
        score: 0,
        my_vote: null,
        legacy: { source: 'site', author_name: 'Autor antigo' },
      }],
      more: [],
      truncated: false,
    });

    expect(result.success).toBe(false);
  });

  it('canonicaliza corpo na criação e fecha voto e denúncia por schema', () => {
    const create = createCommentOperation.inputSchema.parse({
      subjectType: 'site.post',
      subjectId: '42',
      bodyMarkdown: '![mapa](https://example.com/mapa.png)',
    });
    expect(create.bodyMarkdown).toContain('abrir imagem externa');

    expect(setCommentVoteOperation.inputSchema.safeParse({
      commentId: ROOT_ID,
      value: 2,
    }).success).toBe(false);
    expect(createCommentReportOperation.inputSchema.safeParse({
      commentId: ROOT_ID,
      reasonCode: 'inventado',
    }).success).toBe(false);
  });

  it('mescla página de more sem duplicar comentário nem conservar cursor consumido', () => {
    const base = commentsThreadSchema.parse({
      state: 'fresh',
      snapshot_revision: 3,
      comments: [],
      more: [{ parent_id: null, count: 1, cursor: 'consumido' }],
      truncated: true,
    });
    const page = commentsThreadSchema.parse({
      state: 'fresh',
      snapshot_revision: 3,
      comments: [],
      more: [{ parent_id: null, count: 2, cursor: 'seguinte' }],
      truncated: true,
    });

    expect(mergeCommentsThreadPage(base, page, 'consumido').more).toEqual([
      { parent_id: null, count: 2, cursor: 'seguinte' },
    ]);
    expect(() => mergeCommentsThreadPage(
      base,
      { ...page, snapshot_revision: 4 },
      'consumido',
    )).toThrow('revisões diferentes');
  });

  // Sem isto o formulário fica operável, o envio sempre volta
  // `422`/`details_required` e o usuário não descobre o que faltou (achado de
  // review, PR #259).
  it('exige details apenas nos motivos que o contrato obriga', () => {
    const semDetalhe = { commentId: ROOT_ID, reasonCode: 'other' as const };
    const recusado = createCommentReportOperation.inputSchema.safeParse(semDetalhe);
    expect(recusado.success).toBe(false);
    if (!recusado.success) {
      expect(recusado.error.issues[0]?.message).toBe('details_required');
    }

    // Espaço em branco não conta como detalhe: o schema aplica `trim`.
    expect(createCommentReportOperation.inputSchema.safeParse({
      ...semDetalhe,
      details: '   ',
    }).success).toBe(false);

    expect(createCommentReportOperation.inputSchema.safeParse({
      ...semDetalhe,
      details: 'explicação do motivo',
    }).success).toBe(true);

    // Motivo fora da lista aceita ausência de detalhe.
    expect(createCommentReportOperation.inputSchema.safeParse({
      commentId: ROOT_ID,
      reasonCode: 'spam_or_off_topic',
    }).success).toBe(true);
  });
});

/**
 * Campo novo do servidor não pode apagar a conversa.
 *
 * O `accounts.` é deployado independentemente de cada fachada
 * (`deploy-manifest.json`: `auto_deploy_on_push: false` em todos os módulos;
 * `deploy.yml` deploya um módulo por `workflow_dispatch`), então um campo
 * aditivo chega ao bundle antigo ANTES de ele saber do campo. Com `.strict()`
 * o array inteiro falhava junto e a tela ficava em branco — não era degradação,
 * era perda total da conversa (achado P1 do Codex, PR #275).
 *
 * O teste existe porque a regressão é invisível: remover a tolerância continua
 * passando em todo o resto da suíte, e a falha só aparece em produção, no
 * intervalo entre dois deploys.
 */
describe('leitura tolera campo desconhecido do servidor', () => {
  const comentario = {
    id: ROOT_ID,
    parent_id: null,
    root_id: ROOT_ID,
    depth: 0,
    body_markdown: 'Texto',
    created_at: '2026-08-13T10:00:00.000Z',
    edited_at: null,
    state: 'visible',
    author: {
      display_name: 'Ana',
      avatar_url: null,
      badge: null,
      state: 'active',
    },
    upvotes: 0,
    downvotes: 0,
    score: 0,
    my_vote: 0,
    legacy: null,
  };

  const thread = {
    state: 'fresh',
    snapshot_revision: 1,
    comments: [comentario],
    more: [],
    truncated: false,
  };

  it('aceita a árvore quando o comentário traz campo que o cliente não conhece', () => {
    const result = commentsThreadSchema.safeParse({
      ...thread,
      comments: [{ ...comentario, campo_futuro_do_accounts: true }],
    });

    expect(result.success).toBe(true);
  });

  it('aceita campo desconhecido no autor, no nó de paginação e na própria thread', () => {
    const result = commentsThreadSchema.safeParse({
      ...thread,
      campo_futuro_na_thread: 'x',
      comments: [{
        ...comentario,
        author: { ...comentario.author, campo_futuro_no_autor: 1 },
      }],
      more: [{
        parent_id: null,
        count: 3,
        cursor: 'cursor-1',
        campo_futuro_no_more: true,
      }],
      truncated: true,
    });

    expect(result.success).toBe(true);
  });

  it('continua recusando o que de fato viola o contrato', () => {
    // Tolerar campo A MAIS não pode virar tolerar campo ERRADO: a validação do
    // que a UI lê é a garantia que sobra depois de remover o `.strict()`.
    expect(commentsThreadSchema.safeParse({
      ...thread,
      comments: [{ ...comentario, state: 'estado_inexistente' }],
    }).success).toBe(false);

    // A invariante do oculto continua valendo com campo extra presente.
    expect(commentsThreadSchema.safeParse({
      ...thread,
      comments: [{ ...comentario, state: 'removed', campo_futuro: true }],
    }).success).toBe(false);
  });

  it('a escrita continua estrita — campo a mais ali é erro de quem chamou', () => {
    expect(createCommentOperation.inputSchema.safeParse({
      subjectType: 'table',
      subjectId: 'mesa-1',
      bodyMarkdown: 'Olá',
      campo_que_ninguem_definiu: true,
    }).success).toBe(false);
  });
});
