import type { Transaction } from 'kysely';
import { db } from '../db';
import type { Database } from '../db/types';

// Achado de review PR #214 (Codex, P2) — advisory lock de sessao com pg.Pool e
// inseguro: `pg_try_advisory_lock`, o trabalho e o `pg_advisory_unlock` podem
// cair em CONEXOES diferentes do pool. Quando isso acontece o unlock nao libera
// o lock adquirido, e o job fica bloqueado ate a conexao original morrer —
// falha silenciosa que so aparece como "o cron parou de rodar".
//
// `pg_try_advisory_xact_lock` resolve na raiz: o lock e preso a TRANSACAO e o
// Postgres o libera sozinho no commit/rollback. Nao existe unlock explicito
// pra vazar, nem caminho de erro que deixe lock preso.
//
// Helper compartilhado (nao copia por scheduler) porque o bug nasceu de copiar
// o padrao antigo: um lugar so pra acertar, e todo scheduler novo herda a
// versao correta.

/**
 * Roda `fn` sob advisory lock transacional.
 *
 * Devolve `null` quando o lock ja esta ocupado (outra replica esta rodando o
 * mesmo job) — o chamador distingue "nao rodou" de um resultado real.
 *
 * O callback recebe a transacao: todo trabalho tem que usa-la, senao roda fora
 * do escopo do lock e o proposito se perde.
 */
export async function withAdvisoryLock<T>(
  lockKey: number,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T | null> {
  return db.transaction().execute(async (trx) => {
    const lockRow = await trx
      .selectNoFrom((eb) => eb.fn<boolean>('pg_try_advisory_xact_lock', [eb.val(lockKey)]).as('acquired'))
      .executeTakeFirstOrThrow();

    if (!lockRow.acquired) return null;

    return fn(trx);
  });
}
