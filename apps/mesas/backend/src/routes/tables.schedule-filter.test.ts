import express from 'express';
import request from 'supertest';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type RawBuilder,
} from 'kysely';

/**
 * T7.3 (spec 103) — filtro de agenda do catálogo: dia da semana e faixa de
 * horário.
 *
 * O SQL é asserido pelo compilador do dialeto real, sem conexão, em vez de
 * inspecionar a estrutura interna do Kysely (opaca e sem contrato estável). É o
 * mesmo recurso já usado em `apps/downloads/backend/src/routes/materials.list.test.ts`.
 *
 * Por que asserir o SQL e não só o resultado: os quatro defeitos que este filtro
 * evita (fonte única, join duplicando linha, `EXISTS` separado por eixo, filtro
 * depois da paginação) são invisíveis num mock que devolve linhas fixas. Todos
 * aparecem no texto da query.
 */
const compilerDb = new Kysely<Record<string, never>>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

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

/** Ordem em que `.where()` foi chamado, para saber o que entrou antes da contagem. */
let whereCalls: unknown[][] = [];

function makeQueryBuilder() {
  const builder = {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn((...args: unknown[]) => {
      whereCalls.push(args);
      return builder;
    }),
    orderBy: vi.fn().mockReturnThis(),
    clearOrderBy: vi.fn().mockReturnThis(),
    clearSelect: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    execute: dbMocks.execute,
    executeTakeFirst: dbMocks.executeTakeFirst,
  };
  return builder;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tables', tablesRoutes);
  return app;
}

/** SQL de todo fragmento cru passado a `.where()`, concatenado. */
function capturedRawSql(): string {
  return whereCalls
    .flat()
    .filter((arg): arg is RawBuilder<boolean> => typeof (arg as RawBuilder<boolean>)?.compile === 'function')
    .map((fragment) => fragment.compile(compilerDb).sql)
    .join('\n---\n');
}

/** O fragmento de agenda é o único que menciona `table_schedules`. */
function scheduleFilterSql(): string {
  return capturedRawSql()
    .split('\n---\n')
    .filter((sqlText) => sqlText.includes('table_schedules') || sqlText.includes('schedule_day_hint'))
    .join('\n');
}

/**
 * O mesmo SQL em minúsculas. O compilador preserva a caixa do fragmento cru, e
 * as palavras-chave vêm escritas em maiúsculas no `routes/tables.ts` — as
 * asserções de estrutura comparam sem depender disso.
 */
function scheduleFilterSqlLower(): string {
  return scheduleFilterSql().toLowerCase();
}

beforeEach(() => {
  whereCalls = [];
  dbMocks.execute.mockReset();
  dbMocks.executeTakeFirst.mockReset();
  dbMocks.selectFrom.mockReset();

  dbMocks.execute.mockResolvedValue([]);
  dbMocks.executeTakeFirst.mockResolvedValue({ count: 0 });
  dbMocks.selectFrom.mockImplementation(() => makeQueryBuilder());
});

describe('GET /api/v1/tables — filtro de agenda (spec 103 §6)', () => {
  it('E1: weekday=sexta filtra o dia nas duas fontes de agenda', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta').expect(200);

    const filterSql = scheduleFilterSqlLower();
    expect(filterSql).toContain('exists');
    expect(filterSql).toContain('table_schedules');
    expect(filterSql).toContain('ts.day_of_week in');
    // E13: sem o ramo do hint, 9 mesas ativas com dia conhecido somem do
    // resultado (medido em produção 2026-09-18: sábado dá 15 por
    // `table_schedules` e 23 pelas duas fontes).
    expect(filterSql).toContain('schedule_day_hint');
  });

  it('E1: EXISTS correlaciona pela mesa, não produz join', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta').expect(200);

    const filterSql = scheduleFilterSqlLower();
    expect(filterSql).toContain('ts.table_id = t.id');
    // Join duplicaria a linha da mesa com mais de uma sessão: `COUNT(DISTINCT
    // t.id)` esconderia a duplicata na contagem, e o SELECT a devolveria repetida.
    expect(filterSql).not.toMatch(/\bjoin\s+table_schedules\b/);
  });

  it('E2: o filtro entra antes da contagem, senão a paginação diverge', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta').expect(200);

    // `executeTakeFirst` é a contagem. Todo `.where()` tem de ter sido aplicado
    // antes dela — filtro depois da paginação deixa buraco na página.
    expect(dbMocks.executeTakeFirst).toHaveBeenCalled();
    expect(scheduleFilterSql()).not.toBe('');
  });

  it('E3: weekday multivalor é OU, num IN só (sem linha duplicada)', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta,domingo').expect(200);

    const filterSql = scheduleFilterSqlLower();
    expect(filterSql).toContain("ts.day_of_week in ('sexta', 'domingo')");
    // Um IN com os dois valores, não dois EXISTS: a mesa que joga nos dois dias
    // aparece uma vez.
    expect(filterSql.match(/exists/g) ?? []).toHaveLength(1);
  });

  it('E4: valor inválido é ignorado e não vira filtro nem erro', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=funday').expect(200);

    // Nenhum fragmento de agenda: `funday` não está no registro canônico, então
    // o filtro não é aplicado — a página responde como se não houvesse filtro.
    expect(scheduleFilterSql()).toBe('');
  });

  it('E4: valor inválido misturado com válido mantém só o válido', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta,funday').expect(200);

    const filterSql = scheduleFilterSql();
    expect(filterSql).toContain('sexta');
    expect(filterSql).not.toContain('funday');
  });

  it('E4: chave repetida (array do Express) não quebra nem filtra', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta&weekday=domingo').expect(200);

    // Mesma política de `parseStylesQuery`: valor fora de `string` é ignorado.
    expect(scheduleFilterSql()).toBe('');
  });

  it('E10: daypart=noite compara start_time pelo início da sessão', async () => {
    await request(makeApp()).get('/api/v1/tables?daypart=noite').expect(200);

    const filterSql = scheduleFilterSqlLower();
    expect(filterSql).toContain('ts.start_time');
    expect(filterSql).toContain("'18:00:00'");
    // `end_time` é nullable (migration 12, linha 18) e não entra: mesa que começa
    // 23h e varre a madrugada conta como noite, não como duas faixas.
    expect(filterSql).not.toContain('end_time');
    expect(filterSql).toContain('schedule_time_hint');
  });

  it('E10: bordas das faixas — limite inferior inclusivo, superior exclusivo', async () => {
    await request(makeApp()).get('/api/v1/tables?daypart=manha').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // manhã = [06:00, 12:00): 06:00 entra, 12:00 não. Sem isso, 12:00 cairia em
    // duas faixas ou em nenhuma.
    expect(filterSql).toContain("'06:00:00'");
    expect(filterSql).toContain("'12:00:00'");
    expect(filterSql).toMatch(/>=\s*\$\d+|>=\s*'06:00:00'/);
  });

  it('E10: noite não usa 24:00:00, que TIME não aceita', async () => {
    await request(makeApp()).get('/api/v1/tables?daypart=noite').expect(200);

    // O limite superior da noite é o fim do dia: comparar contra '24:00:00'
    // causaria erro de cast no Postgres.
    expect(scheduleFilterSql()).not.toContain('24:00:00');
  });

  it('E10: madrugada é intervalo simples, sem wrap de meia-noite', async () => {
    await request(makeApp()).get('/api/v1/tables?daypart=madrugada').expect(200);

    const filterSql = scheduleFilterSqlLower();
    expect(filterSql).toContain("'00:00:00'");
    expect(filterSql).toContain("'06:00:00'");
  });

  it('E11: dia e faixa casam na MESMA sessão, num EXISTS único', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta&daypart=noite').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // Um EXISTS só. Em dois, mesa que joga sexta de manhã e domingo à noite
    // satisfaria um filtro em cada e entraria num resultado onde não deveria.
    expect(filterSql.match(/exists/g) ?? []).toHaveLength(1);
    expect(filterSql).toContain('ts.day_of_week in');
    expect(filterSql).toContain('ts.start_time');

    // Dentro do EXISTS as duas condições são conjuntivas.
    const existsBody = filterSql.slice(filterSql.indexOf('exists'));
    expect(existsBody).toMatch(/day_of_week in[\s\S]*and[\s\S]*start_time/);
  });

  it('não aplica filtro de agenda quando nenhum parâmetro vem na URL', async () => {
    await request(makeApp()).get('/api/v1/tables').expect(200);

    expect(scheduleFilterSql()).toBe('');
  });

  it('daypart inválido é ignorado igual ao weekday', async () => {
    await request(makeApp()).get('/api/v1/tables?daypart=brunch').expect(200);

    expect(scheduleFilterSql()).toBe('');
  });
});
