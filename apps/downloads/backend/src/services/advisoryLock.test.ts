// Spec 087 (achado de review PR #214, Codex P2) — advisory lock de SESSAO com
// pg.Pool podia adquirir e liberar em conexoes diferentes, deixando o lock
// preso e travando o job ate a conexao original morrer. O helper usa
// pg_try_advisory_xact_lock, que o Postgres libera sozinho no fim da transacao.

const dbMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { transaction: dbMocks.transaction },
}));

import { withAdvisoryLock } from './advisoryLock';

/**
 * Simula `db.transaction().execute(cb)`, entregando ao callback uma transacao
 * cujo `pg_try_advisory_xact_lock` responde `acquired`.
 */
function mockTransaction(acquired: boolean) {
  const calls: string[] = [];
  const trx = {
    selectNoFrom: vi.fn((builder: (eb: unknown) => unknown) => {
      // Registra qual funcao de lock foi pedida, pra suite provar que e a
      // variante transacional (xact), nao a de sessao.
      const eb = Object.assign(
        (..._args: unknown[]) => ({}),
        {
          fn: (name: string) => {
            calls.push(name);
            return { as: () => ({}) };
          },
          val: (value: unknown) => value,
        },
      );
      builder(eb);
      return { executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ acquired }) };
    }),
  };
  dbMocks.transaction.mockReturnValue({
    execute: (cb: (trx: unknown) => Promise<unknown>) => cb(trx),
  });
  return { trx, calls };
}

describe('withAdvisoryLock', () => {
  beforeEach(() => {
    dbMocks.transaction.mockReset();
  });

  it('roda o trabalho dentro da transação quando adquire o lock', async () => {
    const { trx } = mockTransaction(true);
    const work = vi.fn().mockResolvedValue('feito');

    await expect(withAdvisoryLock(123, work)).resolves.toBe('feito');
    // O callback recebe a MESMA transacao que segura o lock.
    expect(work).toHaveBeenCalledWith(trx);
  });

  it('devolve null e não roda o trabalho quando o lock está ocupado', async () => {
    mockTransaction(false);
    const work = vi.fn();

    await expect(withAdvisoryLock(123, work)).resolves.toBeNull();
    expect(work).not.toHaveBeenCalled();
  });

  // O ponto do achado: lock de sessao (`pg_try_advisory_lock`) exige unlock
  // explicito e pode vazar entre conexoes do pool; o transacional nao.
  it('usa o lock transacional, não o de sessão', async () => {
    const { calls } = mockTransaction(true);

    await withAdvisoryLock(123, async () => null);

    expect(calls).toContain('pg_try_advisory_xact_lock');
    expect(calls).not.toContain('pg_try_advisory_lock');
  });

  it('propaga erro do trabalho, deixando a transação abortar e liberar o lock', async () => {
    mockTransaction(true);

    await expect(
      withAdvisoryLock(123, async () => {
        throw new Error('falhou no meio');
      }),
    ).rejects.toThrow('falhou no meio');
  });
});
