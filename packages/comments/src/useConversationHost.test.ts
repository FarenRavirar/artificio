import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConversationTransport, type ConversationHostConfig } from './useConversationHost.js';
import {
  createCommentOperation,
  createCommentReportOperation,
  readCommentsThreadOperation,
} from './conversation.js';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';

const CONFIG: ConversationHostConfig = {
  subjectType: 'site.post',
  sourceApp: 'site',
  conversationPath: '/api/v1/community/conversation',
  reportPath: (id) => `/api/v1/community/comments/${encodeURIComponent(id)}/reports`,
};

/** Captura a requisição que o transporte monta, sem tocar a rede. */
function espiaoDeFetch(resposta: unknown = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify(resposta), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const headersDaChamada = (spy: ReturnType<typeof espiaoDeFetch>, indice = 0) =>
  (spy.mock.calls[indice]?.[1]?.headers ?? {}) as Record<string, string>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transporte da conversa', () => {
  it('declara Content-Type apenas quando há corpo', async () => {
    const spy = espiaoDeFetch();
    const client = createConversationTransport(CONFIG);

    await client.execute(readCommentsThreadOperation, {
      subjectType: 'site.post',
      subjectId: '42',
      sort: 'best',
    }).catch(() => undefined);

    // `GET` sem corpo não declara payload que não existe — e é o que faz uma
    // requisição simples virar preflighted em CORS, relevante no `downloads`,
    // onde frontend e backend são origens distintas.
    expect(headersDaChamada(spy)['Content-Type']).toBeUndefined();

    await client.execute(
      createCommentOperation,
      { subjectType: 'site.post', subjectId: '42', bodyMarkdown: 'olá' },
      { idempotencyKey: 'chave-de-envio-0001' },
    ).catch(() => undefined);

    expect(headersDaChamada(spy, 1)['Content-Type']).toBe('application/json');
    // A chave vem de quem dispara a ação: é o que faz a retentativa do mesmo
    // envio não duplicar a fala.
    expect(headersDaChamada(spy, 1)['Idempotency-Key']).toBe('chave-de-envio-0001');
  });

  it('usa baseUrl quando o módulo tem origem separada, e caminho relativo quando não', async () => {
    const spy = espiaoDeFetch();

    await createConversationTransport(CONFIG)
      .execute(readCommentsThreadOperation, { subjectType: 'site.post', subjectId: '42', sort: 'best' })
      .catch(() => undefined);
    // Same-origin: caminho relativo, que é o que mantém a CSP do `site`
    // (`connect-src 'self'`) cobrindo a conversa sem alteração.
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/^\/api\/v1\/community\/conversation/);

    await createConversationTransport({ ...CONFIG, baseUrl: 'https://api.example' })
      .execute(readCommentsThreadOperation, { subjectType: 'site.post', subjectId: '42', sort: 'best' })
      .catch(() => undefined);
    expect(String(spy.mock.calls[1]?.[0])).toMatch(/^https:\/\/api\.example\//);
  });

  it('roteia denúncia pelo prefixo de moderação, não pelo da conversa', async () => {
    const spy = espiaoDeFetch();

    await createConversationTransport(CONFIG)
      .execute(createCommentReportOperation, { commentId: ROOT_ID, reasonCode: 'spam_or_off_topic' })
      .catch(() => undefined);

    // Prefixo próprio: a denúncia vive sob `/comments/:id/reports`, e montá-la
    // sob o da conversa dependeria da ordem de registro dos routers no Express.
    expect(String(spy.mock.calls[0]?.[0])).toContain('/community/comments/');
    expect(String(spy.mock.calls[0]?.[0])).toContain('/reports');
  });
});
