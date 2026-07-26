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
 * O callback recebe a transacao que segura o lock. Usa-la e obrigatorio pra
 * escrita que deve ser atomica COM o lock (ex.: o expurgo de
 * metricsScheduler.ts, onde o DELETE tem que estar protegido).
 *
 * Nao e obrigatorio pra escrita que precisa ficar VISIVEL a outras conexoes
 * antes de `fn` terminar (achado de review PR #214, Codex P1). O scraper e o
 * caso: ele grava a run e a entrega a um pipeline que roda na conexao global,
 * entao a run precisa estar commitada — dentro da transacao ela seria
 * invisivel, quebrando FK de log e deixando a run presa em `running`. Nesses
 * casos o callback ignora `trx` e usa `db`; o lock segue cumprindo seu
 * proposito, que e impedir DUAS EXECUCOES concorrentes do job.
 *
 * Cuidado ao usar com trabalho longo: a transacao fica aberta enquanto `fn`
 * roda, e transacao longa segura recursos no Postgres.
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
