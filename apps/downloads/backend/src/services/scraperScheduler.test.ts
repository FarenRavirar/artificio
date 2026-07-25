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

import { runScheduledScraperCron } from './scraperScheduler';

function lockChain(acquired: boolean) {
  return { fn: undefined, executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ acquired }) };
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
  executeScraperRunMock.mockClear();
});

describe('runScheduledScraperCron', () => {
  it('dispara exatamente as plataformas com supports_auto_scrape=TRUE no registry (itch_io, grimorios_e_dados, opera_rpg)', async () => {
    dbMocks.selectNoFrom
      .mockReturnValueOnce(lockChain(true)) // pg_try_advisory_lock
      .mockReturnValueOnce({ execute: vi.fn().mockResolvedValue(undefined) }); // pg_advisory_unlock (finally)
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
    dbMocks.selectNoFrom
      .mockReturnValueOnce(lockChain(true))
      .mockReturnValueOnce({ execute: vi.fn().mockResolvedValue(undefined) });
    dbMocks.selectFrom.mockReturnValue(platformSelectChain([]));

    const result = await runScheduledScraperCron();

    expect(result.triggered).toEqual([]);
    expect(executeScraperRunMock).not.toHaveBeenCalled();
  });

  it('lock ocupado (outra instância já rodando): não dispara nada, retorna vazio, nem consulta o registry', async () => {
    dbMocks.selectNoFrom.mockReturnValueOnce(lockChain(false));

    const result = await runScheduledScraperCron();

    expect(result.triggered).toEqual([]);
    expect(executeScraperRunMock).not.toHaveBeenCalled();
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('1 fonte falhando nao trava as demais nem propaga (achado de review PR #193: deadline defensivo) — lock sempre libera', async () => {
    const unlockExecute = vi.fn().mockResolvedValue(undefined);
    dbMocks.selectNoFrom
      .mockReturnValueOnce(lockChain(true))
      .mockReturnValueOnce({ execute: unlockExecute });
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
    expect(unlockExecute).toHaveBeenCalledTimes(1);
  });
});
