// Spec 087 (achado de review PR #214, Codex P2) — o expurgo da tabela de
// dedup de visualizacao nao tinha chamador nenhum. Aqui se testa o contrato do
// agendador: advisory lock, no-op quando o lock esta ocupado e liberacao do
// lock mesmo em falha.

const dbMocks = vi.hoisted(() => ({
  selectNoFrom: vi.fn(),
  deleteFrom: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectNoFrom: dbMocks.selectNoFrom,
    deleteFrom: dbMocks.deleteFrom,
  },
}));

const metricsMocks = vi.hoisted(() => ({
  purgeStaleViewDedup: vi.fn(),
}));

vi.mock('./materialMetrics', () => metricsMocks);

import { runScheduledMetricsMaintenance } from './metricsScheduler';

/**
 * `selectNoFrom` serve a dois usos na funcao: pegar o lock (devolve
 * `{ acquired }`) e liberar (so executa). O stub responde na ordem em que sao
 * chamados, e registra as liberacoes pra suite poder afirmar que o lock nao
 * vazou.
 */
function mockLock(acquired: boolean) {
  const released: string[] = [];
  dbMocks.selectNoFrom.mockImplementation(() => ({
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ acquired }),
    execute: vi.fn().mockImplementation(() => {
      released.push('unlock');
      return Promise.resolve([]);
    }),
  }));
  return released;
}

describe('runScheduledMetricsMaintenance', () => {
  beforeEach(() => {
    dbMocks.selectNoFrom.mockReset();
    dbMocks.deleteFrom.mockReset();
    metricsMocks.purgeStaleViewDedup.mockReset();
    metricsMocks.purgeStaleViewDedup.mockResolvedValue(0);
  });

  it('expurga e devolve a contagem quando obtém o lock', async () => {
    mockLock(true);
    metricsMocks.purgeStaleViewDedup.mockResolvedValue(42);

    await expect(runScheduledMetricsMaintenance()).resolves.toEqual({ purged: 42 });
    expect(metricsMocks.purgeStaleViewDedup).toHaveBeenCalledOnce();
  });

  // Lock ocupado = outra replica ja esta expurgando. Rodar assim mesmo faria N
  // replicas dispararem o mesmo DELETE no mesmo minuto.
  it('não expurga quando o lock está ocupado', async () => {
    mockLock(false);

    await expect(runScheduledMetricsMaintenance()).resolves.toEqual({ purged: null });
    expect(metricsMocks.purgeStaleViewDedup).not.toHaveBeenCalled();
  });

  // Sem o unlock no finally, uma falha do expurgo prenderia o advisory lock e
  // bloquearia TODAS as execucoes seguintes ate reinicio do processo — o mesmo
  // risco que scraperScheduler.ts ja cobre.
  it('libera o lock mesmo quando o expurgo falha', async () => {
    const released = mockLock(true);
    metricsMocks.purgeStaleViewDedup.mockRejectedValue(new Error('falha no delete'));

    await expect(runScheduledMetricsMaintenance()).rejects.toThrow('falha no delete');
    expect(released).toEqual(['unlock']);
  });
});
