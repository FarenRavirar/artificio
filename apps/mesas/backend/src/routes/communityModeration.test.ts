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

const sessionState = vi.hoisted(() => ({ globalRole: 'moderator' as GlobalRole, semSessao: false }));

/**
 * Ordem real de execução dos middlewares, na sequência em que rodaram.
 *
 * Existe para travar o que o CodeQL apontou duas vezes
 * (`js/missing-rate-limiting`, PRs #262 e #268): o limiter tem de rodar **antes**
 * de `authMiddleware`, senão toda requisição paga validação de JWT antes de
 * qualquer freio e a rota vira amplificador. Sem esta lista, inverter a ordem
 * de volta não quebra teste nenhum — e a regressão só reaparece no scan, depois
 * do merge.
 */
const ordemMiddlewares = vi.hoisted(() => [] as string[]);

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ordemMiddlewares.push('auth');
    req.user = {
      userId: LOCAL_USER_ID,
      // Papel LOCAL já rebaixado, exatamente como o middleware real entrega
      // para um moderador central: `resolveEffectiveMesasRole` devolve
      // `player`. Um mock que colocasse 'moderator' aqui esconderia o defeito.
      role: 'player',
      globalRole: sessionState.globalRole,
    };
    // Papel resolvido mas sessão ausente: estado que `proxyAccounts` trata com
    // 401 explícito, em vez de deixar o acesso não-checado virar TypeError
    // dentro de um `void` — 500 opaco no lugar de erro tratado.
    if (!sessionState.semSessao) {
      (req as unknown as { session: unknown }).session = {
        user: { id: ACCOUNTS_USER_ID, email: 'mod@exemplo.com', role: sessionState.globalRole },
      };
    }
    next();
  },
}));

/**
 * Cada limiter vira um passthrough que **anota o próprio nome** na requisição.
 * O passthrough anônimo que estava aqui deixava a rota passar sem revelar qual
 * bucket ela consumiu — foi assim que denúncia e recurso dividiram instância
 * sem nenhum teste falhar (achado de review, PR #268). Com a anotação, a
 * separação exigida por `contrato-http-v1.md` §14 é observável.
 */
const bucketsAplicados: string[] = [];

vi.mock('../middleware/rateLimit.js', () => {
  const marcador =
    (nome: string) => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (req as unknown as { bucket?: string }).bucket = nome;
      bucketsAplicados.push(nome);
      ordemMiddlewares.push('rate-limit');
      next();
    };
  return {
    publicRateLimiter: marcador('read'),
    strictRateLimiter: marcador('moderator-write'),
    commentReportRateLimiter: marcador('report'),
    commentAppealRateLimiter: marcador('appeal'),
  };
});

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

// Env do processo restaurado depois de cada caso: um teste apaga
// SERVICE_CREDENTIAL de proposito, e sem a restauracao o vazamento chegaria a
// qualquer suite que rodasse depois no mesmo worker (achado de review, PR #268).
const envOriginal = {
  ACCOUNTS_URL: process.env.ACCOUNTS_URL,
  SERVICE_CREDENTIAL: process.env.SERVICE_CREDENTIAL,
};

beforeEach(() => {
  vi.clearAllMocks();
  bucketsAplicados.length = 0;
  ordemMiddlewares.length = 0;
  sessionState.globalRole = 'moderator';
  sessionState.semSessao = false;
  process.env.ACCOUNTS_URL = 'https://accounts.exemplo.test';
  process.env.SERVICE_CREDENTIAL = 'mesas-test.segredo';
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [chave, valor] of Object.entries(envOriginal)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
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

  // `correlation_id` no corpo de erro veio junto da unificacao do transporte
  // (PR #268): a moderacao nao o ecoava, e `contrato-http-v1.md` §1.1 exige em
  // TODA resposta de erro. Ganho colateral de tirar a segunda copia do proxy.
  it('fila fora do schema compartilhado vira 502, não corpo repassado', async () => {
    stubFetch(200, { formato: 'inesperado' });

    await request(makeApp())
      .get('/api/v1/community/moderation/queue')
      .expect(502, { error: 'invalid_accounts_response', correlation_id: null });
  });

  it('corpo de erro do accounts. passa adiante sem ser medido contra o schema', async () => {
    // Erro tem shape próprio: validar contra o schema da fila transformaria um
    // `429` legível num `502` opaco.
    stubFetch(429, { error: 'rate_limited' });

    await request(makeApp())
      .get('/api/v1/community/moderation/queue')
      .expect(429, { error: 'rate_limited' });
  });

  it('propaga Retry-After do accounts. num 429 relayado', async () => {
    // O operador de moderação é quem mais insiste ao ver `429`; sem a janela,
    // a retentativa vira chute que realimenta o próprio limite.
    fetchMock = vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      text: () => Promise.resolve(JSON.stringify({ error: 'rate_limited' })),
      headers: { get: (name: string) => (name === 'retry-after' ? '30' : null) },
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(makeApp())
      .get('/api/v1/community/moderation/queue')
      .expect(429);

    expect(response.headers['retry-after']).toBe('30');
  });

  it('não inventa Retry-After num 200', async () => {
    // Contraparte: o header só atravessa em resposta que descreve espera.
    stubFetch(200, { items: [], new_account_comments: [] });

    const response = await request(makeApp())
      .get('/api/v1/community/moderation/queue')
      .expect(200);

    expect(response.headers['retry-after']).toBeUndefined();
  });

  it('accounts. fora do ar vira 503', async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(503, { error: 'community_moderation_unavailable', correlation_id: null });
  });

  it('sessão ausente falha fechada em 401, sem chamar o accounts.', async () => {
    // Ramo que existe porque a ordem dos middlewares pode mudar num refactor:
    // sem a guarda, o acesso não-checado ao id do ator viraria TypeError
    // dentro de um `void` (achado de review, PR #262 no `downloads`).
    sessionState.semSessao = true;

    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(401, { error: 'unauthenticated' });

    expect(fetchMock).not.toHaveBeenCalled();
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

describe('buckets de rate limit independentes por ação', () => {
  /**
   * `contrato-http-v1.md` §14 e `COMMENT_RATE_BUCKETS` separam `report` de
   * `appeal`. Compartilhar instância entre os dois é o pior acoplamento
   * possível nesta superfície: quem é moderado tende a denunciar de volta, e o
   * bucket comum tiraria dele o direito de recorrer da própria punição — a
   * única via de defesa que o contrato lhe dá.
   */
  it('recurso não consome o bucket de denúncia', async () => {
    await request(makeApp())
      .post('/api/v1/community/decisions/decision-1/appeals')
      .send({ justification: 'discordo' })
      .expect(200);

    expect(bucketsAplicados).toEqual(['appeal']);
  });

  it('denúncia usa o bucket de denúncia, e não o do moderador', async () => {
    await request(makeApp())
      .post('/api/v1/community/comments/comment-1/reports')
      .send({ reason: 'spam' })
      .expect(200);

    expect(bucketsAplicados).toEqual(['report']);
  });

  it('ação de moderador não consome o bucket do usuário comum', async () => {
    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(200);

    expect(bucketsAplicados).toEqual(['moderator-write']);
  });

  /**
   * `js/missing-rate-limiting` (CodeQL, PRs #262 e #268). Autenticar antes de
   * limitar faz toda requisição pagar validação de JWT sem freio nenhum: a
   * rota vira amplificador, o atacante gasta um header inválido e o servidor
   * gasta verificação de assinatura. Estes dois casos são o que impede a
   * inversão de voltar sem quebrar nada.
   */
  it('o limiter roda antes da autenticação na rota do usuário comum', async () => {
    await request(makeApp())
      .post('/api/v1/community/decisions/decision-1/appeals')
      .send({ justification: 'discordo' })
      .expect(200);

    expect(ordemMiddlewares).toEqual(['rate-limit', 'auth']);
  });

  it('o limiter roda antes da autenticação também no caminho do moderador', async () => {
    await request(makeApp())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' })
      .expect(200);

    expect(ordemMiddlewares).toEqual(['rate-limit', 'auth']);
  });
});
