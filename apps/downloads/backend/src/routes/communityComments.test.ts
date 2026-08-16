import express from 'express';
import request from 'supertest';

/**
 * T5.3/T5.3c (spec 090) — as travas da fachada de conversa.
 *
 * O que estes testes guardam, em ordem de gravidade:
 * 1. o navegador nunca alcança `/internal/v1` sem passar pela credencial que só
 *    existe server-side (requisito 6a);
 * 2. ownership é recalculado a cada request pelo guard, nunca aceito do payload
 *    (§8, OWASP IDOR);
 * 3. escrita falha fechada — indisponibilidade nunca vira `2xx` (requisito 22c);
 * 4. `Idempotency-Key` é a do cliente, não uma inventada por requisição, senão
 *    a retentativa duplica a fala (§6).
 */

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('undici', () => ({ fetch: fetchMock }));

const guardMock = vi.hoisted(() => vi.fn());
vi.mock('../community/materialSubjectGuard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../community/materialSubjectGuard')>();
  return { ...actual, createMaterialSubjectGuard: () => guardMock };
});

vi.mock('../middleware/rateLimit', () => ({
  readRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const authState = vi.hoisted(() => ({ userId: 'user-1' as string | null }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!authState.userId) {
      res.status(401).json({ error: 'Token inválido ou expirado.' });
      return;
    }
    req.user = { userId: authState.userId, role: 'user' };
    next();
  },
  optionalAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (authState.userId) req.user = { userId: authState.userId, role: 'user' };
    next();
  },
}));

import communityCommentsRoutes, { readCorrelationId } from './communityComments';

/**
 * Prefixo **idêntico ao de produção** (`server.ts:132`), e não um genérico de
 * teste: o router foi montado em `/conversation` justamente para não disputar
 * caminho com o de moderação, que serve `POST .../comments/:id/reports`. Um
 * harness montado em `/comments` passaria verde exercitando um roteamento que
 * não existe no servidor — e a colisão que motivou o prefixo ficaria sem teste.
 */
function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/community/conversation', communityCommentsRoutes);
  return server;
}

function upstream(status: number, text: string, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(text),
    headers: new Headers(headers),
  };
}

const AUTHORIZED = {
  authorized: true as const,
  authorization: {
    exists: true as const,
    visible: true as const,
    commentable: true as const,
    ownerUserId: '11111111-1111-4111-8111-111111111111',
    canonicalPath: '/materiais/guia',
  },
};

beforeEach(() => {
  fetchMock.mockReset();
  guardMock.mockReset();
  // Autorizado por padrão: a LEITURA passou a consultar o guard (achado de
  // review, PR #264), então todo teste que não trate de visibilidade precisa de
  // um assunto válido. Os que exercitam recusa sobrescrevem logo abaixo.
  guardMock.mockResolvedValue(AUTHORIZED);
  authState.userId = 'user-1';
  process.env.ACCOUNTS_URL = 'https://accounts.example';
  process.env.SERVICE_CREDENTIAL = 'token.secret';
});

describe('leitura da conversa', () => {
  it('recusa material invisível com 404, sem chamar o accounts.', async () => {
    guardMock.mockResolvedValue({ authorized: false, reason: 'not_visible' });

    await request(app())
      .get('/api/v1/community/conversation?subject_id=material-em-rascunho')
      .expect(404);

    // Sem o guard na leitura, `?subject_id=<rascunho>` distinguia material
    // existente de inexistente pela resposta — oráculo de existência sobre
    // conteúdo não publicado. Vale mesmo com árvore vazia: o que vaza é o id
    // ser válido (achado de review, PR #264; o mesmo defeito foi corrigido
    // antes no `site`).
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('repassa a árvore do accounts. sem reinterpretar o payload', async () => {
    const thread = { state: 'fresh', snapshot_revision: 3, comments: [], more: [], truncated: false };
    fetchMock.mockResolvedValue(upstream(200, JSON.stringify(thread)));

    const response = await request(app())
      .get('/api/v1/community/conversation?subject_id=material-1&sort=new')
      .expect(200);

    // O contrato é o do pacote (`commentsThreadSchema`, `.strict()`); traduzir
    // shape aqui criaria um segundo contrato para o mesmo dado.
    expect(response.body).toEqual(thread);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/internal/v1/comments?');
    expect(url).toContain('subject_type=downloads.material');
    expect(url).toContain('sort=new');
    expect(init.headers['X-Service-Token']).toBe('token.secret');
  });

  it('manda o ator quando há sessão, para que my_vote apareça', async () => {
    fetchMock.mockResolvedValue(upstream(200, '{}'));

    await request(app()).get('/api/v1/community/conversation?subject_id=material-1').expect(200);

    expect(fetchMock.mock.calls[0][1].headers['X-Acting-User-Id']).toBe('user-1');
  });

  it('lê sem sessão, sem mandar ator', async () => {
    authState.userId = null;
    fetchMock.mockResolvedValue(upstream(200, '{}'));

    await request(app()).get('/api/v1/community/conversation?subject_id=material-1').expect(200);

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Acting-User-Id');
  });

  it('recusa leitura sem subject_id sem chamar o accounts.', async () => {
    await request(app()).get('/api/v1/community/conversation').expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['accounts. fora', () => fetchMock.mockRejectedValue(new Error('ECONNREFUSED')), 503],
    ['timeout', () => fetchMock.mockRejectedValue(Object.assign(new Error('t'), { name: 'TimeoutError' })), 503],
    ['HTML no lugar de JSON', () => fetchMock.mockResolvedValue(upstream(200, '<html>502</html>')), 502],
    ['JSON malformado', () => fetchMock.mockResolvedValue(upstream(200, '{"comments":')), 502],
  ])('falha de forma honesta em %s', async (_label, arrange, expected) => {
    arrange();

    await request(app())
      .get('/api/v1/community/conversation?subject_id=material-1')
      .expect(expected);
  });

  it('devolve 503 quando a credencial de serviço não está configurada', async () => {
    delete process.env.SERVICE_CREDENTIAL;

    await request(app()).get('/api/v1/community/conversation?subject_id=material-1').expect(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('repassa o Retry-After do accounts. no 429, para a retentativa não ser cega', async () => {
    fetchMock.mockResolvedValue(
      upstream(429, JSON.stringify({ error: 'rate_limited' }), { 'Retry-After': '30' }),
    );

    const response = await request(app())
      .get('/api/v1/community/conversation?subject_id=material-1')
      .expect(429);

    expect(response.headers['retry-after']).toBe('30');
  });
});

describe('correlation id (T5.3c, contrato §1.1)', () => {
  it('propaga ao accounts. e ecoa no erro, amarrando as duas pontas', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await request(app())
      .get('/api/v1/community/conversation?subject_id=material-1')
      .set('X-Correlation-Id', 'req-abc-123')
      .expect(503);

    expect(response.body.correlation_id).toBe('req-abc-123');
    expect(fetchMock.mock.calls[0][1].headers['X-Correlation-Id']).toBe('req-abc-123');
  });

  it('ecoa também no 502 de resposta inválida', async () => {
    fetchMock.mockResolvedValue(upstream(200, '<html>502</html>'));

    const response = await request(app())
      .get('/api/v1/community/conversation?subject_id=material-1')
      .set('X-Correlation-Id', 'req-xyz')
      .expect(502);

    expect(response.body.correlation_id).toBe('req-xyz');
  });

  it('devolve null sem o header, em vez de inventar um id', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await request(app())
      .get('/api/v1/community/conversation?subject_id=material-1')
      .expect(503);

    // Id gerado aqui não existiria em log nenhum do cliente: só poluiria a
    // busca dando a impressão de rastreabilidade que não existe.
    expect(response.body.correlation_id).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Correlation-Id');
  });

  it('recusa header acima de 128 caracteres, sem propagar', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await request(app())
      .get('/api/v1/community/conversation?subject_id=material-1')
      .set('X-Correlation-Id', 'x'.repeat(129))
      .expect(503);

    expect(response.body.correlation_id).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Correlation-Id');
  });

  it('filtra caractere de controle — defesa em profundidade, não caminho alcançável', () => {
    // Testado na função, e não por requisição: o cliente HTTP do Node recusa
    // caractere de controle em header ("Invalid character in header content")
    // **antes** de o Express ver, então um teste ponta a ponta mediria a defesa
    // da camada de transporte, não esta. O filtro fica porque o valor vai para
    // linha de log e para o corpo da resposta — response splitting e forja de
    // log são o risco clássico —, e porque a camada de baixo pode mudar.
    expect(readCorrelationId('abc\x01def')).toBeNull();
    expect(readCorrelationId('req-abc-123')).toBe('req-abc-123');
    expect(readCorrelationId('x'.repeat(129))).toBeNull();
    expect(readCorrelationId(undefined)).toBeNull();
  });
});

describe('escrita — o guard decide, o cliente não', () => {
  it('afirma a autorização a partir do guard, ignorando o que o cliente mandou', async () => {
    guardMock.mockResolvedValue(AUTHORIZED);
    fetchMock.mockResolvedValue(upstream(201, '{"id":"c1"}'));

    await request(app())
      .post('/api/v1/community/conversation')
      .set('Idempotency-Key', 'chave-do-cliente')
      .send({
        subject_id: 'material-1',
        body_markdown: 'Olá',
        // Tudo abaixo é hostil e precisa ser descartado.
        subject_owner_user_id: 'dono-inventado',
        canonical_path: '/rota/forjada',
        subject_authorization: { exists: true, visible: true, commentable: true, owner_user_id: 'x', canonical_path: '/x' },
        realm: 'prod',
        source_app: 'site',
      })
      .expect(201);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.subject_owner_user_id).toBe(AUTHORIZED.authorization.ownerUserId);
    expect(body.canonical_path).toBe('/materiais/guia');
    expect(body.subject_authorization.canonical_path).toBe('/materiais/guia');
    // `realm`/`source_app` saem da credencial no `accounts.` (§1.1): mandá-los
    // seria a porta para credencial de beta escrever em produção.
    expect(body).not.toHaveProperty('realm');
    expect(body).not.toHaveProperty('source_app');
  });

  it('devolve 404 uniforme quando o guard recusa, sem distinguir os motivos', async () => {
    const respostas: string[] = [];

    for (const reason of ['not_found', 'not_visible', 'not_commentable']) {
      guardMock.mockResolvedValue({ authorized: false, reason });

      const response = await request(app())
        .post('/api/v1/community/conversation')
        .send({ subject_id: 'material-x', body_markdown: 'Olá' })
        .expect(404);

      respostas.push(JSON.stringify(response.body));
    }

    // O corpo precisa ser IDÊNTICO nos três: distinguir "existe mas está
    // oculto" de "não existe" devolveria um oráculo de existência sobre
    // material em rascunho (§8). `not_visible` e `not_commentable` não podem
    // aparecer em lugar nenhum da resposta.
    expect(new Set(respostas).size).toBe(1);
    expect(respostas[0]).not.toContain('not_visible');
    expect(respostas[0]).not.toContain('not_commentable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exige sessão para escrever', async () => {
    authState.userId = null;

    await request(app())
      .post('/api/v1/community/conversation')
      .send({ subject_id: 'material-1', body_markdown: 'Olá' })
      .expect(401);

    expect(guardMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('repassa a Idempotency-Key do cliente, sem inventar uma', async () => {
    guardMock.mockResolvedValue(AUTHORIZED);
    fetchMock.mockResolvedValue(upstream(201, '{}'));

    await request(app())
      .post('/api/v1/community/conversation')
      .set('Idempotency-Key', 'chave-do-cliente')
      .send({ subject_id: 'material-1', body_markdown: 'Olá' })
      .expect(201);

    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe('chave-do-cliente');
  });

  it.each([
    ['accounts. fora', () => fetchMock.mockRejectedValue(new Error('ECONNREFUSED')), 503],
    ['resposta não-JSON', () => fetchMock.mockResolvedValue(upstream(201, '<html>ok</html>')), 502],
  ])('falha fechada em %s — nunca 2xx', async (_label, arrange, expected) => {
    guardMock.mockResolvedValue(AUTHORIZED);
    arrange();

    const response = await request(app())
      .post('/api/v1/community/conversation')
      .send({ subject_id: 'material-1', body_markdown: 'Olá' })
      .expect(expected);

    expect(response.status).toBeGreaterThanOrEqual(500);
  });

  it('repassa o erro do accounts. com o status original', async () => {
    guardMock.mockResolvedValue(AUTHORIZED);
    fetchMock.mockResolvedValue(upstream(422, '{"error":"body_too_long"}'));

    const response = await request(app())
      .post('/api/v1/community/conversation')
      .send({ subject_id: 'material-1', body_markdown: 'x'.repeat(20) })
      .expect(422);

    expect(response.body).toEqual({ error: 'body_too_long' });
  });

  it('usa a rota de resposta com o pai na URL', async () => {
    guardMock.mockResolvedValue(AUTHORIZED);
    fetchMock.mockResolvedValue(upstream(201, '{}'));

    await request(app())
      .post('/api/v1/community/conversation/pai-1/replies')
      .send({ subject_id: 'material-1', body_markdown: 'Resposta' })
      .expect(201);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://accounts.example/internal/v1/comments/pai-1/replies',
    );
  });
});

describe('edição, retirada e voto', () => {
  it('edita sem consultar o guard de assunto — autoria é decidida no accounts.', async () => {
    fetchMock.mockResolvedValue(upstream(200, '{}'));

    await request(app())
      .patch('/api/v1/community/conversation/c1')
      .send({ body_markdown: 'corrigido', state: 'visible' })
      .expect(200);

    expect(guardMock).not.toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    // §4: o corpo é `strict()` lá e aceita **apenas** `body_markdown`; repassar
    // o payload cru do cliente faria a edição virar `400` por campo extra.
    expect(body).toEqual({ body_markdown: 'corrigido' });
  });

  it('retira o próprio comentário pela rota de auto-retirada', async () => {
    fetchMock.mockResolvedValue(upstream(204, ''));

    await request(app()).delete('/api/v1/community/conversation/c1').expect(204);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://accounts.example/internal/v1/comments/c1');
    expect(init.method).toBe('DELETE');
  });

  it('vota mandando só o value, sem Idempotency-Key', async () => {
    fetchMock.mockResolvedValue(upstream(200, '{"my_vote":1,"upvotes":1,"downvotes":0,"score":1}'));

    await request(app())
      .put('/api/v1/community/conversation/c1/vote')
      .send({ value: 1, comment_id: 'outro' })
      .expect(200);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://accounts.example/internal/v1/comments/c1/vote');
    // Voto é estado absoluto: retry idêntico é no-op por construção, e o
    // contrato dispensa a chave (§7, decisão 12).
    expect(init.headers).not.toHaveProperty('Idempotency-Key');
    // `strict()` no `accounts.`: campo extra viraria `400`, e quem mandou
    // `comment_id` acharia ter votado em outro comentário.
    expect(JSON.parse(init.body as string)).toEqual({ value: 1 });
  });

  it('exige sessão para votar', async () => {
    authState.userId = null;

    await request(app()).put('/api/v1/community/conversation/c1/vote').send({ value: 1 }).expect(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
