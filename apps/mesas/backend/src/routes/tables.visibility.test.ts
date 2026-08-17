import express from 'express';
import request from 'supertest';

const dbMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
  selectFrom: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'user-1', role: 'player', name: 'Pessoa' };
    next();
  },
  optionalAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/requestLogger.js', () => ({ logDatabaseError: vi.fn() }));

vi.mock('../services/systemCatalogProvider.js', () => ({
  resolveSystemIdBySlug: vi.fn(),
  hydrateTableSystemFields: vi.fn(async (tables: unknown[]) => tables),
  loadSystemCatalogTree: vi.fn(async () => []),
}));

import tablesRoutes from './tables.js';

function makeQueryBuilder() {
  return {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: dbMocks.execute,
    executeTakeFirst: dbMocks.executeTakeFirst,
  };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tables', tablesRoutes);
  return app;
}

const visibleTable = {
  id: 'table-1',
  slug: 'mesa-publica',
  title: 'Mesa pública',
  status: 'active',
  archived_at: null,
  origin: 'manual',
  created_at: new Date('2026-07-28T00:00:00.000Z'),
  starts_at: null,
  gm_user_id: null,
  cover_url: null,
  gm_bio_long: null,
};

describe('GET /api/v1/tables/:slug — visibilidade pública', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.execute.mockResolvedValue([]);
    dbMocks.selectFrom.mockImplementation(() => makeQueryBuilder());
  });

  // Mesa que nunca esteve no ar continua 404: 410 ("encerrada") afirmaria que
  // ela existiu publicamente e revelaria a existência de um rascunho a quem
  // chutou a URL.
  it.each([
    ['rascunho', { ...visibleTable, status: 'draft' }],
    ['em revisão', { ...visibleTable, status: 'pending_review' }],
  ])('devolve 404 para mesa %s (nunca foi pública)', async (_label, table) => {
    dbMocks.executeTakeFirst.mockResolvedValue(table);

    const response = await request(makeApp()).get(`/api/v1/tables/${table.slug}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Mesa não encontrada.' });
  });

  it('devolve 404 para slug inexistente', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(undefined);

    const response = await request(makeApp()).get('/api/v1/tables/nao-existe');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Mesa não encontrada.' });
  });

  // Relato de produção (2026-08-11): mesa encerrada devolvia 404 e o visitante
  // via "Mesa não encontrada", sem distinguir mesa que saiu do ar de link
  // errado. Agora devolve 410 com o payload da tela "Mesa Encerrada".
  it('devolve 410 com autoria para mesa arquivada', async () => {
    // Duas chamadas em sequência: a mesa, depois o nome de quem arquivou.
    // `mockResolvedValue` único devolveria a própria mesa como se fosse o autor,
    // e `closed_by_name` passaria sem nunca exercer a consulta de autoria.
    dbMocks.executeTakeFirst
      .mockResolvedValueOnce({
        ...visibleTable,
        archived_at: new Date('2026-07-28T01:00:00.000Z'),
        archived_by: 'user-1',
        closed_reason: 'gm',
      })
      .mockResolvedValueOnce({ display_name: 'Mestre Fulano' });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(response.body.error).toBe('Mesa encerrada.');
    expect(response.body.data).toMatchObject({
      slug: visibleTable.slug,
      title: visibleTable.title,
      closed_reason: 'gm',
      closed_by_name: 'Mestre Fulano',
    });
    expect(response.body.data.closed_at).toBe('2026-07-28T01:00:00.000Z');
  });

  // Importada vencida não tem `archived_at` — ninguém a encerrou, ela expirou.
  // A data exibida é o limite calculado, e o motivo é derivado, não gravado.
  it('devolve 410 com motivo derivado para importada expirada', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      origin: 'imported',
      created_at: new Date('2026-07-01T00:00:00.000Z'),
      starts_at: null,
      archived_at: null,
      archived_by: null,
      closed_reason: null,
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(response.body.data.closed_reason).toBe('auto_expired');
    expect(response.body.data.closed_by_name).toBeNull();
    // 5 dias após a criação, a mesma regra de `isImportedTableExpired`.
    expect(response.body.data.closed_at).toBe('2026-07-06T00:00:00.000Z');
  });

  // O outro ramo de `importedTableExpiryDate`: quando a data do evento vem
  // ANTES dos 5 dias, ela é que vale. Sem este caso, o `LEAST` da regra nunca
  // é exercido — o teste acima passa mesmo se a implementação ignorar
  // `starts_at`.
  it('usa starts_at como data de encerramento quando vence antes dos 5 dias', async () => {
    // `isImportedTableExpired` compara com `new Date()` real — sem congelar
    // o relógio, o teste depende do dia em que roda ser depois do prazo
    // (achado CodeRabbit, PR #255).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'));
    try {
      dbMocks.executeTakeFirst.mockResolvedValue({
        ...visibleTable,
        origin: 'imported',
        created_at: new Date('2026-07-01T00:00:00.000Z'),
        starts_at: new Date('2026-07-03T20:00:00.000Z'),
        archived_at: null,
        archived_by: null,
        closed_reason: null,
      });

      const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

      expect(response.status).toBe(410);
      expect(response.body.data.closed_reason).toBe('auto_expired');
      expect(response.body.data.closed_by_name).toBeNull();
      expect(response.body.data.closed_at).toBe('2026-07-03T20:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  // Nada que sirva para inscrição entra na resposta de mesa encerrada: mesa
  // fora do ar não segue captando candidato.
  it('não expõe contato nem dados do GM em mesa encerrada', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      archived_at: new Date('2026-07-28T01:00:00.000Z'),
      archived_by: null,
      closed_reason: 'admin',
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    // Allowlist estrita, e não `not.toHaveProperty` de campos conhecidos: campo
    // sensível novo entra em silêncio numa lista negativa, e falha aqui numa
    // positiva. Foi o que aconteceu com `id` (T7.8, spec 090) — a adição foi
    // deliberada e este teste a barrou até ser revista, que é o comportamento
    // correto.
    //
    // `id` é o UUID da mesa, `subject_id` da conversa. Não é dado de contato
    // nem do GM: ele já viaja publicamente na leitura de comentários
    // (`GET /api/v1/community/conversation?subject_id=<id>`) e não revela nada
    // que o `410` não revele — a mesa existiu e acabou, que é justamente o que
    // o `410` afirma (RFC 9110 §15.5.11).
    expect(Object.keys(response.body.data).sort()).toEqual([
      'closed_at',
      'closed_by_name',
      'closed_reason',
      'id',
      'slug',
      'title',
    ]);
  });

  it('devolve o id da mesa no 410, para a conversa encerrada poder ser lida', async () => {
    // T7.8 (spec 090, requisito 26a): "encerrada preserva a leitura". Sem o
    // `id` no corpo, a tela de mesa encerrada não tem `subject_id` para pedir a
    // conversa, e a metade do 26a que garante a leitura não existe no cliente.
    // O `slug` não serve: identifica a rota, e o assunto do comentário é o id.
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      archived_at: new Date('2026-07-28T01:00:00.000Z'),
      archived_by: null,
      closed_reason: 'admin',
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(response.body.data.id).toBe(visibleTable.id);
  });

  // Estado terminal explícito: 410 mesmo sem `archived_at`, com o motivo vindo
  // do próprio status e a data aproximada por `updated_at`.
  it.each(['ended', 'cancelled'])('devolve 410 para mesa %s', async (status) => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      status,
      archived_at: null,
      archived_by: null,
      closed_reason: null,
      updated_at: new Date('2026-08-01T12:00:00.000Z'),
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(response.body.data.closed_reason).toBe(status);
    expect(response.body.data.closed_at).toBe('2026-08-01T12:00:00.000Z');
  });

  // Mesa lotada continua pública — só não aceita mais gente. Tratá-la como
  // encerrada esconderia do jogador a mesa que ele quer acompanhar.
  it('mantém mesa full acessível (200), não encerrada', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({ ...visibleTable, status: 'full' });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(200);
  });

  it('mantém mesa pública acessível', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(visibleTable);

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(200);
  });
});

describe('interações de mesa pública — visibilidade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.execute.mockResolvedValue([]);
    dbMocks.selectFrom.mockImplementation(() => makeQueryBuilder());
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      archived_at: new Date('2026-07-28T01:00:00.000Z'),
    });
  });

  it.each([
    ['POST', '/api/v1/tables/mesa-publica/view'],
    ['POST', '/api/v1/tables/mesa-publica/click'],
    ['GET', '/api/v1/tables/mesa-publica/favorite'],
    ['POST', '/api/v1/tables/mesa-publica/favorite'],
  ] as const)('%s %s devolve 404 para mesa arquivada', async (method, path) => {
    const response = method === 'GET'
      ? await request(makeApp()).get(path)
      : await request(makeApp()).post(path);

    expect(response.status).toBe(404);
  });
});
