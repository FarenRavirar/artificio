// T5.4 (spec 084) — cron so dispara fontes SEM adapter de anti-bot
// (D119/spec): confirma que drivethrurpg/dms_guild NUNCA aparecem na lista
// disparada pelo cron, e que o advisory lock impede execucao concorrente.
// T6.3/T6.5 (spec 085, Fase 6): lista deixou de ser hardcode
// (CRON_SOURCE_PLATFORMS), agora vem do registry
// (download_scraper_platform.supports_auto_scrape) — teste prova
// nao-regressao: mesmas 3 fontes de antes disparam quando o registry
// devolve exatamente elas, nenhuma outra passa.

const executeScraperRunMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../routes/scraper', () => ({
  executeScraperRun: executeScraperRunMock,
}));

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  selectNoFrom: vi.fn(),
  insertInto: vi.fn(),
}));
vi.mock('../db', () => ({ db: dbMocks }));

// Spec 087 (achado de review PR #214, Codex P2): o advisory lock saiu daqui pro
// helper compartilhado services/advisoryLock.ts, agora TRANSACIONAL
// (pg_try_advisory_xact_lock) — o par lock/unlock de sessao podia cair em
// conexoes diferentes do pool e deixar o lock preso. O helper tem suite propria
// (advisoryLock.test.ts); aqui ele e mockado pra isolar o comportamento do cron.
const lockMocks = vi.hoisted(() => ({
  withAdvisoryLock: vi.fn(),
}));
vi.mock('./advisoryLock', () => lockMocks);

import { runScheduledScraperCron } from './scraperScheduler';

/**
 * Concede o lock e entrega ao callback uma transacao que reusa os mesmos stubs
 * de `db` — o cron passou a inserir `download_scraper_run` pela transacao do
 * lock, nao pela conexao global.
 */
function grantLock() {
  lockMocks.withAdvisoryLock.mockImplementation(async (_key: number, fn: (trx: unknown) => Promise<unknown>) =>
    fn({ insertInto: dbMocks.insertInto }),
  );
}

/** Lock ocupado: o helper devolve null sem rodar o callback. */
function denyLock() {
  lockMocks.withAdvisoryLock.mockResolvedValue(null);
}

function platformSelectChain(slugs: string[]) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(slugs.map((slug) => ({ slug }))),
  };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.selectNoFrom.mockReset();
  dbMocks.insertInto.mockReset();
  lockMocks.withAdvisoryLock.mockReset();
  executeScraperRunMock.mockClear();
});

describe('runScheduledScraperCron', () => {
  it('dispara exatamente as plataformas com supports_auto_scrape=TRUE no registry (itch_io, grimorios_e_dados, opera_rpg)', async () => {
    grantLock();
    dbMocks.selectFrom.mockReturnValue(platformSelectChain(['itch_io', 'grimorios_e_dados', 'opera_rpg']));

    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-id' }),
    });

    const result = await runScheduledScraperCron();

    expect(dbMocks.selectFrom).toHaveBeenCalledWith('download_scraper_platform');
    expect(result.triggered).toEqual(['itch_io', 'grimorios_e_dados', 'opera_rpg']);
    expect(result.triggered).not.toContain('drivethrurpg');
    expect(result.triggered).not.toContain('dms_guild');
    expect(executeScraperRunMock).toHaveBeenCalledTimes(3);
  });

  it('não dispara nada quando o registry não tem nenhuma plataforma com supports_auto_scrape=TRUE', async () => {
    grantLock();
    dbMocks.selectFrom.mockReturnValue(platformSelectChain([]));

    const result = await runScheduledScraperCron();

    expect(result.triggered).toEqual([]);
    expect(executeScraperRunMock).not.toHaveBeenCalled();
  });

  it('lock ocupado (outra instância já rodando): não dispara nada, retorna vazio, nem consulta o registry', async () => {
    denyLock();

    const result = await runScheduledScraperCron();

    expect(result.triggered).toEqual([]);
    expect(executeScraperRunMock).not.toHaveBeenCalled();
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('1 fonte falhando nao trava as demais nem propaga (achado de review PR #193: deadline defensivo) — lock sempre libera', async () => {
    grantLock();
    dbMocks.selectFrom.mockReturnValue(platformSelectChain(['itch_io', 'grimorios_e_dados', 'opera_rpg']));

    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-id' }),
    });
    executeScraperRunMock.mockRejectedValueOnce(new Error('falha simulada'));

    const result = await runScheduledScraperCron();

    // Falha de 1 fonte nao interrompe as demais (todas continuam marcadas
    // como "triggered" — o outcome real de cada uma fica em download_scraper_run).
    expect(result.triggered).toEqual(['itch_io', 'grimorios_e_dados', 'opera_rpg']);
    // O lock nao vaza: com xact_lock o Postgres libera no fim da transacao, entao
    // o que se prova aqui e que o cron NAO propagou a falha da fonte (a
    // transacao fecha normal). O antigo `expect(unlockExecute)` sumiu junto com
    // o unlock explicito, que deixou de existir.
    expect(lockMocks.withAdvisoryLock).toHaveBeenCalledTimes(1);
  });
});
