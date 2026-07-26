// Spec 087 (achado de review PR #214, Codex P2) — o expurgo da tabela de
// dedup de visualizacao nao tinha chamador nenhum. Aqui se testa o contrato do
// agendador sobre o helper de advisory lock: expurga quando pega o lock, sai
// em no-op quando nao pega, e propaga falha.
//
// O lock em si (transacional, via pg_try_advisory_xact_lock) tem suite propria
// em advisoryLock.test.ts — aqui ele e mockado pra isolar o agendador.

const lockMocks = vi.hoisted(() => ({
  withAdvisoryLock: vi.fn(),
}));

vi.mock('./advisoryLock', () => lockMocks);

const metricsMocks = vi.hoisted(() => ({
  purgeStaleViewDedup: vi.fn(),
}));

vi.mock('./materialMetrics', () => metricsMocks);

import { runScheduledMetricsMaintenance } from './metricsScheduler';

/** Simula o helper concedendo o lock e entregando uma transacao ao callback. */
function grantLock() {
  const fakeTrx = { marker: 'trx' };
  lockMocks.withAdvisoryLock.mockImplementation(async (_key: number, fn: (trx: unknown) => Promise<unknown>) =>
    fn(fakeTrx),
  );
  return fakeTrx;
}

describe('runScheduledMetricsMaintenance', () => {
  beforeEach(() => {
    lockMocks.withAdvisoryLock.mockReset();
    metricsMocks.purgeStaleViewDedup.mockReset();
    metricsMocks.purgeStaleViewDedup.mockResolvedValue(0);
  });

  it('expurga e devolve a contagem quando obtém o lock', async () => {
    grantLock();
    metricsMocks.purgeStaleViewDedup.mockResolvedValue(42);

    await expect(runScheduledMetricsMaintenance()).resolves.toEqual({ purged: 42 });
    expect(metricsMocks.purgeStaleViewDedup).toHaveBeenCalledOnce();
  });

  // O DELETE tem que rodar DENTRO da transacao do lock — se rodasse na
  // instancia global, ficaria fora do escopo protegido e o lock seria decorativo.
  it('expurga usando a transação do lock, não a conexão global', async () => {
    const fakeTrx = grantLock();

    await runScheduledMetricsMaintenance();

    expect(metricsMocks.purgeStaleViewDedup).toHaveBeenCalledWith(fakeTrx);
  });

  // Lock ocupado = outra replica ja esta expurgando. O helper devolve null.
  it('não expurga quando o lock está ocupado', async () => {
    lockMocks.withAdvisoryLock.mockResolvedValue(null);

    await expect(runScheduledMetricsMaintenance()).resolves.toEqual({ purged: null });
    expect(metricsMocks.purgeStaleViewDedup).not.toHaveBeenCalled();
  });

  it('propaga falha do expurgo para o agendador tratar', async () => {
    grantLock();
    metricsMocks.purgeStaleViewDedup.mockRejectedValue(new Error('falha no delete'));

    await expect(runScheduledMetricsMaintenance()).rejects.toThrow('falha no delete');
  });
});
