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

import tablesRoutes, { parseStylesQuery } from './tables.js';

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

type CatalogBody = {
  pagination: { total: number };
  data: Array<{ id: string; slots_open: number }>;
};

/**
 * Valida a resposta antes de indexá-la. Sem isso, `body.data.map(...)` sobre um
 * payload inesperado quebra com erro opaco ou compara `undefined` em silêncio.
 */
function normalizeCatalogBody(body: unknown): CatalogBody {
  if (typeof body !== 'object' || body === null) {
    throw new Error(`resposta não é objeto: ${JSON.stringify(body)}`);
  }
  const { pagination, data } = body as { pagination?: unknown; data?: unknown };
  if (typeof pagination !== 'object' || pagination === null || typeof (pagination as { total?: unknown }).total !== 'number') {
    throw new Error(`pagination.total ausente ou não numérico: ${JSON.stringify(pagination)}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`data não é array: ${JSON.stringify(data)}`);
  }
  const rows = data.map((row, index) => {
    if (typeof row !== 'object' || row === null) {
      throw new Error(`data[${index}] não é objeto`);
    }
    const { id, slots_open: slotsOpen } = row as { id?: unknown; slots_open?: unknown };
    if (typeof id !== 'string') throw new Error(`data[${index}].id não é string: ${JSON.stringify(id)}`);
    if (typeof slotsOpen !== 'number') {
      throw new Error(`data[${index}].slots_open não é número: ${JSON.stringify(slotsOpen)}`);
    }
    return { id, slots_open: slotsOpen };
  });
  return { pagination: { total: (pagination as { total: number }).total }, data: rows };
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

  it('decodifica cada estilo depois de separar o delimitador da lista', () => {
    expect(parseStylesQuery('intriga%2Cpol%C3%ADtica,narrativo')).toEqual([
      'intriga,política',
      'narrativo',
    ]);
    expect(parseStylesQuery('%E0%A4%A')).toEqual(['%E0%A4%A']);
  });

  // Express entrega array em chave repetida; antes o cast `as string` mentia e
  // o `.split` derrubava a rota em 500.
  it('não quebra com styles repetido na query (styles=a&styles=b)', async () => {
    const response = await request(makeApp()).get('/api/v1/tables?styles=epico&styles=sombrio');

    expect(response.status).toBe(200);
  });

  it('aplica o filtro de styles quando a query traz lista separada por vírgula', async () => {
    const response = await request(makeApp()).get('/api/v1/tables?styles=epico,sombrio');

    expect(response.status).toBe(200);
    expect(parseStylesQuery('epico,sombrio')).toEqual(['epico', 'sombrio']);
    expect(parseStylesQuery(['epico', 'sombrio'])).toEqual([]);
    expect(parseStylesQuery(undefined)).toEqual([]);
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
    // `response.body` é `any` no supertest: normalizar antes de indexar, senão
    // uma resposta em formato inesperado passa como `undefined` em vez de falhar.
    const body = normalizeCatalogBody(response.body);
    expect(body.pagination.total).toBe(4);
    expect(body.data).toHaveLength(4);
    expect(body.data.map((table) => table.slots_open)).toEqual([5, 5, 2, 0]);
    expect(body.data.slice(0, 2).map((table) => table.id)).toEqual([
      'table-5',
      'table-5-older',
    ]);
  });

  it('select da lista inclui t.schedule_day_status (T4.0u, card "Horário Personalizado")', async () => {
    await request(makeApp()).get('/api/v1/tables');

    const mainSelect = builders[0].select.mock.calls[0]?.[0];
    expect(Array.isArray(mainSelect)).toBe(true);
    expect(mainSelect).toContain('t.schedule_day_status');
  });

  // T4.0u (spec 096): next_schedule do catálogo agora carrega o status da
  // TABELA (schedule_day_status — sentinela 'to_define') + o texto livre de
  // table_schedules.notes, que o editor grava na agenda personalizada (R20).
  it('compõe next_schedule com schedule_day_status e notes (T4.0u)', async () => {
    dbMocks.execute
      .mockResolvedValueOnce([{ id: 'table-5', slug: 'mesa-cinco-vagas', schedule_day_status: 'to_define' }])
      .mockResolvedValueOnce([]) // table_contacts
      .mockResolvedValueOnce([
        {
          table_id: 'table-5',
          day_of_week: 'sexta',
          start_time: '20:00:00',
          frequency: 'semanal',
          sort_order: 1,
          notes: 'Agenda combinada com o grupo',
        },
      ]); // table_schedules
    dbMocks.executeTakeFirst.mockResolvedValue({ count: '1' });

    const response = await request(makeApp()).get('/api/v1/tables');

    expect(response.status).toBe(200);
    const row = (response.body as { data?: unknown }).data as Array<Record<string, unknown>> | undefined;
    expect(Array.isArray(row)).toBe(true);
    const nextSchedule = row?.[0]?.next_schedule;
    expect(nextSchedule).toMatchObject({
      day_of_week: 'sexta',
      start_time: '20:00:00',
      frequency: 'semanal',
      schedule_day_status: 'to_define',
      notes: 'Agenda combinada com o grupo',
    });
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
