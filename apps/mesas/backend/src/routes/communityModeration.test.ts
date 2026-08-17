import request from 'supertest';
import express from 'express';

/**
 * T7.7 (spec 090) — moderação sobre a superfície nova do `mesas`.
 *
 * O teste que carrega esta suíte é o do guard de papel. O `mesas` **rebaixa** o
 * `moderator` central a `player` (`middleware/auth.ts:41-47`, fixado em
 * `auth.roles.test.ts:9-12`), e isso está certo para capacidade de domínio. Se
 * a fachada usasse `requireRole`, o moderador global levaria `403` em todo
 * comentário de mesa e o poder que `spec.md:346` concede não existiria — sem
 * erro em lugar nenhum, que é o modo como este tipo de defeito sobrevive.
 */

const LOCAL_USER_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNTS_USER_ID = '99999999-9999-4999-8999-999999999999';

type GlobalRole = 'user' | 'moderator' | 'admin';

const sessionState = vi.hoisted(() => ({ globalRole: 'moderator' as GlobalRole }));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      userId: LOCAL_USER_ID,
      // Papel LOCAL já rebaixado, exatamente como o middleware real entrega
      // para um moderador central: `resolveEffectiveMesasRole` devolve
      // `player`. Um mock que colocasse 'moderator' aqui esconderia o defeito.
      role: 'player',
      globalRole: sessionState.globalRole,
    };
    (req as unknown as { session: unknown }).session = {
      user: { id: ACCOUNTS_USER_ID, email: 'mod@exemplo.com', role: sessionState.globalRole },
    };
    next();
  },
}));

vi.mock('../middleware/rateLimit.js', () => ({
  publicRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  strictRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import communityModerationRoutes from './communityModeration.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/community', communityModerationRoutes);
  return app;
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(status = 200, body: unknown = { ok: true }): void {
  fetchMock = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: () => null },
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionState.globalRole = 'moderator';
  process.env.ACCOUNTS_URL = 'https://accounts.exemplo.test';
  process.env.SERVICE_CREDENTIAL = 'mesas-test.segredo';
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('T7.7 — guard de papel lê o global, não o local rebaixado', () => {
  it('moderador central retira comentário de mesa, apesar de ser player local', async () => {
    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('admin central também passa', async () => {
    sessionState.globalRole = 'admin';
    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(200);
  });

  it('usuário comum leva 403 e o accounts. não é chamado', async () => {
    sessionState.globalRole = 'user';
    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(403, { error: 'forbidden' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usuário comum ainda pode denunciar — denúncia não é moderação', async () => {
    sessionState.globalRole = 'user';
    await request(makeApp())
      .post('/api/v1/community/comments/comment-1/reports')
      .send({ reason_code: 'spam' })
      .expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('identidade do ator na auditoria', () => {
  it('manda o id central, nunca o UUID local do mesas', async () => {
    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(200);

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    // Id trocado aqui atribuiria a decisão de moderação à conta errada no
    // registro de auditoria — dano que não aparece como erro.
    expect(init.headers['X-Acting-User-Id']).toBe(ACCOUNTS_USER_ID);
    expect(init.headers['X-Acting-User-Id']).not.toBe(LOCAL_USER_ID);
  });

  it('rota de sessão repassa cookie e não usa credencial de serviço', async () => {
    await request(makeApp())
      .get('/api/v1/community/reports')
      .set('Cookie', 'artificio_session=abc')
      .expect(200);

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Cookie).toBe('artificio_session=abc');
    expect(init.headers['X-Service-Token']).toBeUndefined();
  });
});

describe('query filtrada e degradação', () => {
  it('só os parâmetros nomeados atravessam para o accounts.', async () => {
    // Fila vazia mas VÁLIDA contra `moderationQueueSchema`: sem os dois arrays,
    // a resposta cai no ramo de 502 e o teste mediria a coisa errada.
    stubFetch(200, { items: [], new_account_comments: [] });

    await request(makeApp())
      .get('/api/v1/community/moderation/queue?source_app=mesas&limit=10&injetado=1')
      .expect(200);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('source_app=mesas');
    expect(url).toContain('limit=10');
    // Filtro não revisado por esta fachada não chega ao `accounts.`.
    expect(url).not.toContain('injetado');
  });

  it('fila fora do schema compartilhado vira 502, não corpo repassado', async () => {
    stubFetch(200, { formato: 'inesperado' });

    await request(makeApp())
      .get('/api/v1/community/moderation/queue')
      .expect(502, { error: 'invalid_accounts_response' });
  });

  it('corpo de erro do accounts. passa adiante sem ser medido contra o schema', async () => {
    // Erro tem shape próprio: validar contra o schema da fila transformaria um
    // `429` legível num `502` opaco.
    stubFetch(429, { error: 'rate_limited' });

    await request(makeApp())
      .get('/api/v1/community/moderation/queue')
      .expect(429, { error: 'rate_limited' });
  });

  it('accounts. fora do ar vira 503', async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(503, { error: 'community_moderation_unavailable' });
  });

  it('credencial ausente falha fechada em 503, sem chamar o accounts.', async () => {
    delete process.env.SERVICE_CREDENTIAL;

    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(503);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
