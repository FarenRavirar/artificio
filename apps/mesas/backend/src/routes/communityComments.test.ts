import request from 'supertest';
import express from 'express';

/**
 * T7.2/T7.4/T7.5 (spec 090) — fachada de conversa do `mesas`.
 *
 * O teste central aqui é o de T7.2: provar que o `X-Acting-User-Id` enviado ao
 * `accounts.` é o id **central** da sessão, e não o UUID local de
 * `mesas.users`. Os dois são UUID e nenhum compilador os distingue — só um
 * teste que compare os dois valores pega a troca.
 */

/** UUID local (`mesas.users.id`), o que `req.user.userId` carrega. */
const LOCAL_USER_ID = '11111111-1111-4111-8111-111111111111';
/** ID da MESMA conta no `accounts.` (`session.user.id`). É este que deve viajar. */
const ACCOUNTS_USER_ID = '99999999-9999-4999-8999-999999999999';

const TABLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RASCUNHO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ENCERRADA_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OWNER_GOOGLE_ID = '77777777-7777-4777-8777-777777777777';

const guardMock = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock('../community/tableSubjectGuard.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../community/tableSubjectGuard.js')>();
  return {
    ...actual,
    createTableSubjectGuard: () => guardMock.run,
  };
});

// Os dois middlewares populam AS DUAS coisas, como o real faz: `req.user` com o
// id local e `req.session` com a sessão central. É essa coexistência que torna
// a troca possível — um mock que só popule `req.user` não conseguiria falhar.
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: LOCAL_USER_ID, role: 'player' };
    (req as unknown as { session: unknown }).session = {
      user: { id: ACCOUNTS_USER_ID, email: 'jogador@exemplo.com', role: 'user' },
    };
    next();
  },
  optionalAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: LOCAL_USER_ID, role: 'player' };
    (req as unknown as { session: unknown }).session = {
      user: { id: ACCOUNTS_USER_ID, email: 'jogador@exemplo.com', role: 'user' },
    };
    next();
  },
}));

vi.mock('../middleware/rateLimit.js', () => ({
  publicRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  strictRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import communityCommentsRoutes, { readCorrelationId } from './communityComments.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/community/conversation', communityCommentsRoutes);
  return app;
}

const authorized = {
  authorized: true as const,
  authorization: {
    exists: true,
    visible: true,
    commentable: true,
    ownerUserId: OWNER_GOOGLE_ID,
    canonicalPath: '/mesas/mesa-de-teste',
  },
};

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(status = 201, body: unknown = { id: 'comment-1' }): void {
  fetchMock = vi.fn().mockResolvedValue({
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: () => null },
  });
  vi.stubGlobal('fetch', fetchMock);
}

function lastCall(): { url: string; init: { headers: Record<string, string>; body?: string } } {
  const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body?: string }];
  return { url, init };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ACCOUNTS_URL = 'https://accounts.exemplo.test';
  process.env.SERVICE_CREDENTIAL = 'mesas-test.segredo';
  guardMock.run.mockResolvedValue(authorized);
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('T7.2 — identificador enviado ao accounts.', () => {
  it('manda o id da sessão central, nunca o UUID local do mesas', async () => {
    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(201);

    const { init } = lastCall();
    expect(init.headers['X-Acting-User-Id']).toBe(ACCOUNTS_USER_ID);
    // A asserção que dá sentido à anterior: sem ela, um mock que devolvesse o
    // mesmo valor nos dois campos passaria e o defeito continuaria de pé.
    expect(init.headers['X-Acting-User-Id']).not.toBe(LOCAL_USER_ID);
  });

  it('vale também para voto e edição, não só para criação', async () => {
    await request(makeApp())
      .put(`/api/v1/community/conversation/${'comment-1'}/vote`)
      .send({ value: 1 })
      .expect(201);
    expect(lastCall().init.headers['X-Acting-User-Id']).toBe(ACCOUNTS_USER_ID);
  });
});

describe('T7.3 — o guard decide, e a leitura aceita o que a escrita recusa', () => {
  it('mesa encerrada continua legível (not_commentable não vira 404)', async () => {
    guardMock.run.mockResolvedValue({ authorized: false, reason: 'not_commentable' });
    stubFetch(200, { comments: [] });

    await request(makeApp())
      .get(`/api/v1/community/conversation?subject_id=${ENCERRADA_ID}`)
      .expect(200);

    expect(fetchMock).toHaveBeenCalled();
  });

  it('mesa em rascunho devolve 404 sem consultar o accounts.', async () => {
    guardMock.run.mockResolvedValue({ authorized: false, reason: 'not_visible' });

    await request(makeApp())
      .get(`/api/v1/community/conversation?subject_id=${RASCUNHO_ID}`)
      .expect(404, { error: 'subject_not_found' });

    // O oráculo de existência que a PR #264 fechou: sem o guard na LEITURA, a
    // diferença entre `200` com árvore vazia e `404` confirmaria que o id
    // existe.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('escrita em mesa não comentável para no guard, sem chamar o accounts.', async () => {
    guardMock.run.mockResolvedValue({ authorized: false, reason: 'not_commentable' });

    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ subject_id: ENCERRADA_ID, body_markdown: 'tarde demais' })
      .expect(404);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('corpo da escrita montado na fachada', () => {
  it('usa a afirmação do guard e ignora o que o cliente mandou', async () => {
    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({
        subject_id: TABLE_ID,
        body_markdown: 'olá',
        // Cliente hostil tentando escolher dono e caminho de volta.
        subject_owner_user_id: LOCAL_USER_ID,
        canonical_path: 'https://phishing.example/mesas/x',
      })
      .expect(201);

    const body = JSON.parse(lastCall().init.body ?? '{}') as Record<string, unknown>;
    expect(body.subject_type).toBe('mesas.table');
    expect(body.subject_owner_user_id).toBe(OWNER_GOOGLE_ID);
    expect(body.canonical_path).toBe('/mesas/mesa-de-teste');
  });

  it('recusa 400 quando falta subject_id, sem chamar o accounts.', async () => {
    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ body_markdown: 'sem alvo' })
      .expect(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('degradação (requisito 22c)', () => {
  it('accounts. fora do ar vira 503, não 500', async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(503, { error: 'community_comments_unavailable', correlation_id: null });
  });

  it('resposta que não é JSON vira 502, nunca corpo cru repassado', async () => {
    fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('<html>502 Bad Gateway</html>'),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchMock);

    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(502, { error: 'invalid_accounts_response', correlation_id: null });
  });

  it('credencial ausente falha fechada em 503, sem chamar o accounts.', async () => {
    delete process.env.SERVICE_CREDENTIAL;

    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(503);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propaga Retry-After do accounts. para o cliente', async () => {
    fetchMock = vi.fn().mockResolvedValue({
      status: 429,
      text: () => Promise.resolve(JSON.stringify({ error: 'rate_limited' })),
      headers: { get: (name: string) => (name === 'retry-after' ? '30' : null) },
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(429);

    // Sem isto o `429` chega ao navegador sem dizer QUANDO tentar de novo, e a
    // retentativa vira chute que realimenta o próprio rate limit.
    expect(response.headers['retry-after']).toBe('30');
  });
});

describe('correlação e idempotência', () => {
  it('propaga X-Correlation-Id do cliente e ecoa no erro', async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error('timeout'));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeApp())
      .post('/api/v1/community/conversation')
      .set('X-Correlation-Id', 'abc-123')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(503, { error: 'community_comments_unavailable', correlation_id: 'abc-123' });
  });

  // A validação é testada na função, e não por requisição: o Node recusa
  // header com caractere de controle antes de chegar ao handler, então um
  // teste HTTP nunca exercitaria este ramo.
  it.each([
    ['caractere de controle (response splitting)', 'abc' + String.fromCharCode(13, 10) + 'X-Injetado: 1'],
    ['acima de 128 caracteres', 'a'.repeat(129)],
    ['vazio', ''],
    ['ausente', undefined],
  ])('descarta correlação inválida: %s', (_label, value) => {
    expect(readCorrelationId(value)).toBeNull();
  });

  it('aceita correlação ASCII dentro do limite', () => {
    expect(readCorrelationId('abc-123')).toBe('abc-123');
  });

  it('repassa a Idempotency-Key do cliente sem gerar uma própria', async () => {
    await request(makeApp())
      .post('/api/v1/community/conversation')
      .set('Idempotency-Key', 'chave-do-cliente')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(201);

    expect(lastCall().init.headers['Idempotency-Key']).toBe('chave-do-cliente');
  });

  it('não inventa Idempotency-Key quando o cliente não manda', async () => {
    await request(makeApp())
      .post('/api/v1/community/conversation')
      .send({ subject_id: TABLE_ID, body_markdown: 'olá' })
      .expect(201);

    // Chave gerada aqui não sobreviveria à retentativa do cliente, que é
    // exatamente o caso que ela existe para cobrir.
    expect(lastCall().init.headers['Idempotency-Key']).toBeUndefined();
  });
});
