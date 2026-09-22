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

/**
 * `/schedule-facets` monta a query com o template `sql\`...\`` e chama
 * `.execute(db)`, que não passa por `selectFrom` — o mock do builder não a
 * alcança. Interceptar `executeQuery` do driver é o ponto onde o nó já está
 * compilado, então o teste lê o SQL real em vez de inspecionar o template.
 */
const rawExecute = vi.hoisted(() => vi.fn());

vi.mock('../db/index.js', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
    // `sql\`...\`.execute(db)` chama `db.getExecutor().executeQuery(node)`.
    getExecutor: () => ({
      transformQuery: (node: unknown) => node,
      compileQuery: (node: unknown) => node,
      executeQuery: rawExecute,
      provideConnection: async (consumer: (conn: unknown) => unknown) =>
        consumer({ executeQuery: rawExecute }),
      takeQueryEndListeners: () => [],
      adapter: new PostgresAdapter(),
    }),
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

/**
 * Sequência de eventos na ordem real de execução, para provar que o filtro entra
 * ANTES da contagem. Só contar chamadas não mede isso: o teste passava com o
 * `.where()` aplicado depois de `executeTakeFirst` (achado do CodeRabbit, PR #327).
 */
let eventLog: ('schedule-where' | 'count')[] = [];

function makeQueryBuilder() {
  const builder = {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn((...args: unknown[]) => {
      whereCalls.push(args);
      if (rawSqlOf(args).includes('table_schedules')) eventLog.push('schedule-where');
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

/** SQL dos fragmentos crus de UMA chamada de `.where()`. */
function rawSqlOf(args: unknown[]): string {
  return args
    .filter((arg): arg is RawBuilder<boolean> => typeof (arg as RawBuilder<boolean>)?.compile === 'function')
    .map((fragment) => fragment.compile(compilerDb).sql)
    .join(' ');
}

/** O fragmento de agenda foi aplicado antes da consulta de contagem. */
function filterAppliedBeforeCount(): boolean {
  const whereIndex = eventLog.indexOf('schedule-where');
  const countIndex = eventLog.indexOf('count');
  return whereIndex >= 0 && countIndex >= 0 && whereIndex < countIndex;
}

/** SQL de todo fragmento cru passado a `.where()`, concatenado. */
function capturedRawSql(): string {
  return whereCalls
    .flat()
    .filter((arg): arg is RawBuilder<boolean> => typeof (arg as RawBuilder<boolean>)?.compile === 'function')
    .map((fragment) => fragment.compile(compilerDb).sql)
    .join('\n---\n');
}

/**
 * SQL das queries cruas que passaram pelo executor, em minúsculas.
 *
 * Medido: o mock recebe o NÓ (`kind`/`sqlFragments`/`parameters`), não um objeto
 * já compilado — `compileQuery` do executor falso devolve o próprio nó. Então o
 * texto sai pelo compilador do dialeto real, o mesmo `compilerDb` que os outros
 * helpers usam, e o teste lê SQL de verdade em vez da estrutura do template.
 */
function facetsSqlLower(): string {
  return rawExecute.mock.calls
    .map(([node]) => compilerDb.getExecutor().compileQuery(node as never, { queryId: 'facets' } as never).sql)
    .join('\n')
    .toLowerCase();
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
  eventLog = [];
  dbMocks.execute.mockReset();
  dbMocks.executeTakeFirst.mockReset();
  dbMocks.selectFrom.mockReset();
  rawExecute.mockReset();
  rawExecute.mockResolvedValue({ rows: [] });

  dbMocks.execute.mockResolvedValue([]);
  dbMocks.executeTakeFirst.mockImplementation(async () => {
    eventLog.push('count');
    return { count: 0 };
  });
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
    //
    // A ordem é o que importa, e `expect(sql).not.toBe('')` não a media: passava
    // igual com o filtro aplicado DEPOIS da contagem. `callOrder` do vi.fn dá a
    // sequência global de invocação (achado do CodeRabbit na PR #327).
    expect(dbMocks.executeTakeFirst).toHaveBeenCalled();
    expect(scheduleFilterSql()).not.toBe('');
    expect(filterAppliedBeforeCount()).toBe(true);
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
    // O limite SUPERIOR tem de ser exclusivo. `toContain("'12:00:00'")` passa
    // igual com `<=`, e aí 12:00 cai em manhã e em tarde (achado do CodeRabbit).
    expect(filterSql).toMatch(/<\s*(\$\d+|'12:00:00')/);
    expect(filterSql).not.toMatch(/<=\s*(\$\d+|'12:00:00')/);
  });

  it('P1: agenda placeholder de "Horário personalizado" não casa o filtro', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=segunda&daypart=noite').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // `deriveSchedule` grava linha de placeholder `segunda`/`19:00` com os dois
    // status em 'to_define' (editorMapping.ts:130-180), porque as colunas são NOT
    // NULL e o enum do banco não tem 'to_define'. Sem o gate de status, essa mesa
    // apareceria em `weekday=segunda` e `daypart=noite` sem o mestre ter dito isso.
    // Medido em produção 2026-09-19: 12 mesas com dia 'to_define' e 21 com horário
    // 'to_define', nenhuma com linha hoje — o falso positivo é latente, não ativo.
    expect(filterSql).toContain("t.schedule_day_status = 'defined'");
    expect(filterSql).toContain("t.schedule_time_status = 'defined'");
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

  it('D4: weekday=to_define casa status e ausência de hint, sem IN de dia', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=to_define').expect(200);

    const filterSql = scheduleFilterSqlLower();
    expect(filterSql).toContain("t.schedule_day_status = 'to_define'");
    expect(filterSql).toContain('t.schedule_day_hint is null');
    // `to_define` não existe no CHECK de `day_of_week` nem no de
    // `schedule_day_hint`: num IN devolveria zero linha em silêncio.
    expect(filterSql).not.toContain("'to_define')");
    expect(filterSql).not.toContain('day_of_week in');
  });

  it('D4: to_define combinado com dia nomeado mantém os dois ramos', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta,to_define').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // O dia nomeado segue no IN, sem o sentinela junto.
    expect(filterSql).toContain("ts.day_of_week in ('sexta')");
    expect(filterSql).toContain("t.schedule_day_status = 'to_define'");
    // Os ramos são alternativos: mesa de sexta OU mesa de agenda desconhecida.
    expect(filterSql).toContain(' or ');
  });

  it('P1: to_define + daypart preserva o AND da faixa (achado Codex PR #331)', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=to_define&daypart=noite').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // Sem o AND da faixa, o ramo do `to_define` entrava no OR sozinho e trazia
    // QUALQUER mesa de dia indefinido, inclusive as que jogam de manhã —
    // contrariando a conjunção dia+faixa que os outros ramos já respeitam.
    const tbdBranch = filterSql.slice(filterSql.indexOf("t.schedule_day_status = 'to_define'"));
    expect(tbdBranch).toContain("t.schedule_time_status = 'defined'");
    expect(tbdBranch).toContain("'18:00:00'");

    // O horário pode estar no hint OU em `table_schedules`: medido em produção,
    // a única mesa com dia 'to_define' e horário 'defined' tem
    // `schedule_time_hint='19:00'` e ZERO linhas em `table_schedules`.
    expect(tbdBranch).toContain('t.schedule_time_hint');
    expect(tbdBranch).toContain('ts_tbd.start_time');
  });

  it('P1: to_define como único dia omite os ramos de agenda conhecida (Codex PR #331)', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=to_define&daypart=noite').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // Sem dia nomeado, os ramos de sessão e de hint carregariam só a faixa e,
    // unidos por OR, trariam qualquer mesa noturna de dia DEFINIDO. O único
    // EXISTS permitido é o do próprio ramo "A definir" (`ts_tbd`).
    expect(filterSql).not.toContain('ts.table_id = t.id');
    expect(filterSql.match(/exists/g) ?? []).toHaveLength(1);
    expect(filterSql).toContain('ts_tbd.table_id = t.id');
    // A faixa sobre o hint aparece uma vez só: a do ramo "A definir".
    // `noite` é `>= 18:00` sem limite superior, então a coluna aparece 1 vez.
    expect(filterSql.match(/t\.schedule_time_hint/g) ?? []).toHaveLength(1);

    // Nada de faixa ANTES do ramo "A definir": é onde os ramos genéricos estariam.
    const beforeToDefine = filterSql.slice(0, filterSql.indexOf("t.schedule_day_status = 'to_define'"));
    expect(beforeToDefine).not.toContain('ts.start_time');
    expect(beforeToDefine).not.toContain('t.schedule_time_hint');
  });

  it('P1: dia nomeado + to_define + faixa mantém os três ramos', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=sexta,to_define&daypart=noite').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // Com `sexta` pedido, a mesa de sexta à noite é resultado legítimo: os ramos
    // de agenda conhecida seguem, e o de "A definir" entra ao lado.
    expect(filterSql).toContain('ts.table_id = t.id');
    expect(filterSql).toContain("ts.day_of_week in ('sexta')");
    expect(filterSql).toContain("t.schedule_day_status = 'to_define'");
  });

  it('P1: filtro só de faixa segue sem ramo "A definir"', async () => {
    await request(makeApp()).get('/api/v1/tables?daypart=noite').expect(200);

    const filterSql = scheduleFilterSqlLower();
    expect(filterSql).toContain('ts.table_id = t.id');
    expect(filterSql).not.toContain("t.schedule_day_status = 'to_define'");
  });

  it('D4: to_define sozinho não exige horário nenhum', async () => {
    await request(makeApp()).get('/api/v1/tables?weekday=to_define').expect(200);

    const filterSql = scheduleFilterSqlLower();
    // Sem daypart na URL não há faixa a conferir; exigir `time_status` aqui
    // esconderia as mesas com os DOIS eixos indefinidos, que são a maioria.
    expect(filterSql).not.toContain("t.schedule_time_status = 'defined'");
    expect(filterSql).not.toContain('ts_tbd');
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

describe('GET /api/v1/tables/schedule-facets — contador de agenda (D4)', () => {
  it('conta "A definir" fora do CTE, com o mesmo predicado do filtro', async () => {
    rawExecute.mockResolvedValue({
      rows: [
        { kind: 'weekday', value: 'sexta', count: '14' },
        { kind: 'weekday', value: 'to_define', count: '1' },
        { kind: 'daypart', value: 'noite', count: '55' },
      ],
    });

    const response = await request(makeApp()).get('/api/v1/tables/schedule-facets').expect(200);

    // A opção precisa vir do backend com contagem própria: a mesa de agenda
    // desconhecida não tem linha no CTE `agenda` (os dois ramos do UNION exigem
    // dia ou hint), então sem o SELECT extra ela voltaria com zero e a UI a
    // ofereceria como filtro que não traz nada.
    expect(response.body.data.weekdays).toContainEqual({ value: 'to_define', count: 1 });

    const facetsSql = facetsSqlLower();
    expect(facetsSql).toContain("'to_define' as value");
    // Mesmo predicado do terceiro ramo do filtro, senão contador e resultado
    // divergem: o usuário veria "1" e a lista traria outra coisa.
    expect(facetsSql).toContain("t.schedule_day_status = 'to_define'");
    expect(facetsSql).toContain('t.schedule_day_hint is null');
    // O predicado de visibilidade entra aqui também. Medido em produção: das 12
    // mesas com dia 'to_define' e sem hint, 11 são `origin='imported'` fora da
    // janela e invisíveis no catálogo — sem ele o contador prometeria 12.
    expect(facetsSql).toContain('origin');
  });
});
