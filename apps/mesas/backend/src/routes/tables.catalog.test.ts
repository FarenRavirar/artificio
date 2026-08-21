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
    clearOrderBy: vi.fn().mockReturnThis(),
    clearSelect: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    execute: dbMocks.execute,
    executeTakeFirst: dbMocks.executeTakeFirst,
  };
}

type QueryBuilder = ReturnType<typeof makeQueryBuilder>;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tables', tablesRoutes);
  return app;
}

// Fixture conforme o schema: slots_open e INTEGER NOT NULL desde a
// migration 100 (spec 094, T0.4) — por isso nenhuma linha com null. 5, 2 e 0
// exercitam a ordenação por vagas, com created_at distintos para o desempate.
const slotFixtures = [
  {
    id: 'table-5',
    slug: 'mesa-cinco-vagas',
    title: 'Mesa cinco vagas',
    slots_open: 5,
    created_at: new Date('2026-08-01T00:00:00.000Z'),
  },
  {
    id: 'table-5-older',
    slug: 'mesa-cinco-vagas-antiga',
    title: 'Mesa cinco vagas antiga',
    slots_open: 5,
    created_at: new Date('2026-07-01T00:00:00.000Z'),
  },
  {
    id: 'table-2',
    slug: 'mesa-duas-vagas',
    title: 'Mesa duas vagas',
    slots_open: 2,
    created_at: new Date('2026-08-02T00:00:00.000Z'),
  },
  {
    id: 'table-0',
    slug: 'mesa-zero-vagas',
    title: 'Mesa zero vagas',
    slots_open: 0,
    created_at: new Date('2026-08-03T00:00:00.000Z'),
  },
];

// Chamadas de orderBy do builder principal, como [coluna, direção]. O mock de
// clearOrderBy não limpa nada (mockReturnThis), então as chamadas acumulam —
// exatamente o que permite verificar o que cada ramo de sort montou.
function orderByCalls(builder: QueryBuilder): Array<[string, string]> {
  return builder.orderBy.mock.calls.map((call) => [call[0] as string, call[1] as string]);
}

describe('GET /api/v1/tables — catálogo público (ordenacao e filtros)', () => {
  let builders: QueryBuilder[];

  beforeEach(() => {
    vi.clearAllMocks();
    builders = [];
    dbMocks.selectFrom.mockImplementation(() => {
      const builder = makeQueryBuilder();
      builders.push(builder);
      return builder;
    });
    dbMocks.execute.mockResolvedValue([]);
    dbMocks.executeTakeFirst.mockResolvedValue({ count: '0' });
  });

  it('sort=slots monta slots_open DESC com desempate por created_at DESC', async () => {
    const response = await request(makeApp()).get('/api/v1/tables?sort=slots');

    expect(response.status).toBe(200);
    const calls = orderByCalls(builders[0]);
    expect(builders[0].clearOrderBy).toHaveBeenCalled();
    expect(calls.slice(-2)).toEqual([
      ['t.slots_open', 'desc'],
      ['t.created_at', 'desc'],
    ]);
  });

  it('sem sort (default) mantém somente a ordenação por recência, sem slots_open', async () => {
    const response = await request(makeApp()).get('/api/v1/tables');

    expect(response.status).toBe(200);
    const calls = orderByCalls(builders[0]);
    expect(calls).toEqual([['t.created_at', 'desc']]);
    expect(calls).not.toContainEqual(['t.slots_open', 'desc']);
  });

  it('sort desconhecido cai no default sem quebrar', async () => {
    const response = await request(makeApp()).get('/api/v1/tables?sort=nao-existe');

    expect(response.status).toBe(200);
    const calls = orderByCalls(builders[0]);
    expect(calls).toEqual([['t.created_at', 'desc']]);
    expect(calls).not.toContainEqual(['t.slots_open', 'desc']);
    expect(calls).not.toContainEqual(['t.price_value', 'desc']);
  });

  // D0.4: ending_soon saiu do contrato — não existe ramo para ele. O handler
  // trata como sort desconhecido (default) e a resposta continua 200.
  it('ending_soon não existe em nenhum ramo (cai no default)', async () => {
    const response = await request(makeApp()).get('/api/v1/tables?sort=ending_soon');

    expect(response.status).toBe(200);
    const calls = orderByCalls(builders[0]);
    expect(calls).toEqual([['t.created_at', 'desc']]);
    expect(calls).not.toContainEqual(['t.slots_open', 'desc']);
  });

  it('filtro type é repassado ao where com o valor recebido', async () => {
    const response = await request(makeApp()).get('/api/v1/tables?type=campanha');

    expect(response.status).toBe(200);
    expect(builders[0].where).toHaveBeenCalledWith('t.type', '=', 'campanha');
  });

  it('featured permanece aceito pelo backend (parâmetro preexistente intocado)', async () => {
    const response = await request(makeApp()).get('/api/v1/tables?featured=true');

    expect(response.status).toBe(200);
    expect(builders[0].where).toHaveBeenCalledWith('t.featured', '=', true);
  });

  // Fixture 5/2/0 conforme o schema NOT NULL: o handler devolve as linhas
  // recebidas do banco — a ordenação real é responsabilidade do SQL montado
  // (coberto acima). O que este teste prende é que nenhuma fixture nula entra
  // no domínio e que a resposta preserva slots_open numérico.
  it('fixture 5/5/2/0 respeita NOT NULL e inclui empate ordenado por data', async () => {
    dbMocks.execute.mockResolvedValueOnce(slotFixtures).mockResolvedValue([]);
    dbMocks.executeTakeFirst.mockResolvedValue({ count: '4' });

    const response = await request(makeApp()).get('/api/v1/tables?sort=slots');

    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(4);
    expect(response.body.data).toHaveLength(4);
    const slotsOpen = response.body.data.map((table: { slots_open: unknown }) => table.slots_open);
    expect(slotsOpen).toEqual([5, 5, 2, 0]);
    expect(response.body.data.slice(0, 2).map((table: { id: string }) => table.id)).toEqual([
      'table-5',
      'table-5-older',
    ]);
    expect(slotsOpen.every((value: unknown) => typeof value === 'number')).toBe(true);
  });

  it('mantém os demais sorts aprovados (popular, recent, price_asc, price_desc)', async () => {
    await request(makeApp()).get('/api/v1/tables?sort=popular');
    await request(makeApp()).get('/api/v1/tables?sort=recent');
    await request(makeApp()).get('/api/v1/tables?sort=price_asc');
    await request(makeApp()).get('/api/v1/tables?sort=price_desc');

    // Cada request cria um builder novo; popular usa leftJoin(table_metrics).
    const popularCalls = orderByCalls(builders[0]);
    const recentCalls = orderByCalls(builders[1]);
    const priceAscCalls = orderByCalls(builders[2]);
    const priceDescCalls = orderByCalls(builders[3]);
    expect(builders[0].leftJoin).toHaveBeenCalledWith('table_metrics as tm', 'tm.table_id', 't.id');
    expect(popularCalls.at(-1)).toEqual(['t.created_at', 'desc']);
    expect(recentCalls.at(-1)).toEqual(['t.created_at', 'desc']);
    expect(recentCalls).not.toContainEqual(['t.slots_open', 'desc']);
    expect(priceAscCalls).toContainEqual(['t.price_value', 'asc']);
    expect(priceAscCalls).toContainEqual(['t.created_at', 'desc']);
    expect(priceDescCalls).toContainEqual(['t.price_value', 'desc']);
    expect(priceDescCalls).toContainEqual(['t.created_at', 'desc']);
  });
});
