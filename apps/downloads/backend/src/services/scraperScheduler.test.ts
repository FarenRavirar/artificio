// T5.4 (spec 084) — cron so dispara fontes SEM adapter de anti-bot
// (D119/spec): confirma que drivethrurpg/dms_guild NUNCA aparecem na lista
// disparada pelo cron, e que o advisory lock impede execucao concorrente.

const executeScraperRunMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../routes/scraper', () => ({
  executeScraperRun: executeScraperRunMock,
}));

const dbMocks = vi.hoisted(() => ({
  selectNoFrom: vi.fn(),
  insertInto: vi.fn(),
}));
vi.mock('../db', () => ({ db: dbMocks }));

import { runScheduledScraperCron } from './scraperScheduler';

function lockChain(acquired: boolean) {
  return { fn: undefined, executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ acquired }) };
}

beforeEach(() => {
  dbMocks.selectNoFrom.mockReset();
  dbMocks.insertInto.mockReset();
  executeScraperRunMock.mockClear();
});

describe('runScheduledScraperCron', () => {
  it('dispara SOMENTE itch_io, grimorios_e_dados e opera_rpg — nunca drivethrurpg/dms_guild', async () => {
    dbMocks.selectNoFrom
      .mockReturnValueOnce(lockChain(true)) // pg_try_advisory_lock
      .mockReturnValueOnce({ execute: vi.fn().mockResolvedValue(undefined) }); // pg_advisory_unlock (finally)

    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-id' }),
    });

    const result = await runScheduledScraperCron();

    expect(result.triggered).toEqual(['itch_io', 'grimorios_e_dados', 'opera_rpg']);
    expect(result.triggered).not.toContain('drivethrurpg');
    expect(result.triggered).not.toContain('dms_guild');
    expect(executeScraperRunMock).toHaveBeenCalledTimes(3);
  });

  it('lock ocupado (outra instância já rodando): não dispara nada, retorna vazio', async () => {
    dbMocks.selectNoFrom.mockReturnValueOnce(lockChain(false));

    const result = await runScheduledScraperCron();

    expect(result.triggered).toEqual([]);
    expect(executeScraperRunMock).not.toHaveBeenCalled();
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('sempre libera o lock (finally), mesmo se executeScraperRun falhar', async () => {
    const unlockExecute = vi.fn().mockResolvedValue(undefined);
    dbMocks.selectNoFrom
      .mockReturnValueOnce(lockChain(true))
      .mockReturnValueOnce({ execute: unlockExecute });

    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-id' }),
    });
    executeScraperRunMock.mockRejectedValueOnce(new Error('falha simulada'));

    await expect(runScheduledScraperCron()).rejects.toThrow('falha simulada');
    expect(unlockExecute).toHaveBeenCalledTimes(1);
  });
});
