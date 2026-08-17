import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('undici', () => ({ fetch: fetchMock }));

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

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ordemMiddlewares.push('auth');
    req.user = { userId: 'moderator-user', role: 'moderator' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

/**
 * Limiters mockados por marcador nomeado, e não deixados reais.
 *
 * Rodando de verdade, o store de cada bucket é compartilhado entre os casos da
 * suite: crescer o arquivo ou baixar um teto faz um caso falhar por cota
 * esgotada, com `429` que não parece rate limit em teste nenhum. E passthrough
 * anônimo esconderia qual instância cada rota consumiu — foi assim que denúncia
 * e recurso dividiram bucket sem nada falhar (achado de review, PR #268).
 *
 * O marcador resolve os dois: elimina o estado entre casos e torna a separação
 * exigida por `contrato-http-v1.md` §14 observável.
 */
const bucketsAplicados: string[] = [];

vi.mock('../middleware/rateLimit', () => {
  const marcador =
    (nome: string) => (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      bucketsAplicados.push(nome);
      ordemMiddlewares.push('rate-limit');
      next();
    };
  return {
    readRateLimiter: marcador('read'),
    writeRateLimiter: marcador('write'),
    publicRateLimiter: marcador('public'),
    commentReportRateLimiter: marcador('report'),
    commentAppealRateLimiter: marcador('appeal'),
  };
});

import router from './communityModeration';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/community', router);
  return server;
}

describe('fachada browser-safe de moderação comunitária', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bucketsAplicados.length = 0;
    ordemMiddlewares.length = 0;
    process.env.ACCOUNTS_URL = 'http://accounts.test';
    process.env.SERVICE_CREDENTIAL = 'downloads-prod.credential';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], new_account_comments: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  });

  it('mantém credencial e ator somente no salto backend-to-backend', async () => {
    const response = await request(app()).get('/api/v1/community/moderation/queue?status=open');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://accounts.test/internal/v1/comments/moderation-queue?status=open',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Service-Token': 'downloads-prod.credential',
          'X-Acting-User-Id': 'moderator-user',
        }),
      }),
    );
    expect(response.headers).not.toHaveProperty('x-service-token');
  });

  // Fail-closed no caminho que mais engana: o `accounts.` responde `200`, então
  // sem validação a UI receberia lista malformada e trataria como "fila vazia"
  // — indistinguível de "nenhum caso aberto" (achado de review, PR #262).
  // `correlation_id` no corpo de erro entrou com a unificacao do transporte
  // (PR #268): esta fachada nao o ecoava, e o contrato §1.1 exige em TODA
  // resposta de erro. Ganho de tirar a segunda copia do proxy.
  it('devolve 502 quando o accounts responde 200 com payload fora do schema', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: 'nao-e-array' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await request(app()).get('/api/v1/community/moderation/queue');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'invalid_accounts_response', correlation_id: null });
  });

  // Campo aditivo do `accounts.` não pode derrubar a fila: ele é deployado
  // antes da fachada saber do campo, e `.strict()` transformaria a mudança
  // compatível em 502 (mesmo achado de review).
  it('aceita campo desconhecido no payload da fila, sem 502', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      items: [],
      new_account_comments: [],
      campo_futuro: 'ainda nao conhecido pela fachada',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await request(app()).get('/api/v1/community/moderation/queue');

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('campo_futuro');
  });

  it('preserva 409 e o payload para a UI não apagar trabalho concorrente', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'case_already_resolved' } }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await request(app())
      .post('/api/v1/community/moderation/cases/case-1/resolution')
      .set('Idempotency-Key', 'attempt-1')
      .send({ verdicts: [], action: 'no_change', reason: 'Já tratado' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'case_already_resolved' } });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'Idempotency-Key': 'attempt-1' });
  });

  it('falha fechado quando a credencial não existe', async () => {
    delete process.env.SERVICE_CREDENTIAL;
    const response = await request(app()).get('/api/v1/community/moderation/queue');
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('buckets de rate limit independentes por ação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bucketsAplicados.length = 0;
    ordemMiddlewares.length = 0;
    process.env.ACCOUNTS_URL = 'http://accounts.test';
    process.env.SERVICE_CREDENTIAL = 'downloads-prod.credential';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  });

  /**
   * As três rotas abaixo usavam `writeRateLimiter` — o bucket de **criar e
   * editar material**, outro domínio inteiro. Publicar 60 materiais deixava o
   * usuário sem cota para denunciar abuso; e denúncia dividindo bucket com
   * recurso tira de quem foi moderado a via de defesa contra a própria punição.
   */
  it('denúncia não consome o bucket de escrita de material', async () => {
    await request(app())
      .post('/api/v1/community/comments/comment-1/reports')
      .send({ reason: 'spam' });

    expect(bucketsAplicados).toEqual(['report']);
  });

  it('retirada de denúncia usa o mesmo bucket da denúncia', async () => {
    await request(app()).delete('/api/v1/community/reports/report-1');

    expect(bucketsAplicados).toEqual(['report']);
  });

  it('recurso não consome o bucket de denúncia', async () => {
    await request(app())
      .post('/api/v1/community/decisions/decision-1/appeals')
      .send({ justification: 'discordo' });

    expect(bucketsAplicados).toEqual(['appeal']);
  });

  /**
   * `js/missing-rate-limiting` (CodeQL, PRs #262 e #268). Autenticar antes de
   * limitar faz toda requisição pagar validação de JWT sem freio nenhum: a rota
   * vira amplificador, o atacante gasta um header inválido e o servidor gasta
   * verificação de assinatura. Estes dois casos são o que impede a inversão de
   * voltar sem quebrar nada.
   */
  it('o limiter roda antes da autenticação na rota do usuário comum', async () => {
    await request(app())
      .post('/api/v1/community/decisions/decision-1/appeals')
      .send({ justification: 'discordo' });

    expect(ordemMiddlewares).toEqual(['rate-limit', 'auth']);
  });

  it('o limiter roda antes da autenticação também no caminho do moderador', async () => {
    await request(app())
      .post('/api/v1/community/moderation/comments/comment-1/removal')
      .send({ reason: 'spam' });

    expect(ordemMiddlewares).toEqual(['rate-limit', 'auth']);
  });
});
