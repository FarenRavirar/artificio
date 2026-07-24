import cron from 'node-cron';
import { db } from '../db';
import { checkLink } from './linkChecker';

// T2.7 (spec 082) — DEB-075-01 fechado: job agendado interno (node-cron, sem
// dependencia de infra CI externa), roda 1x/dia checando o link de todo
// material publicado com external_url. Mesma logica de checkLink ja usada
// pelo endpoint sob demanda (POST /admin/materials/:id/check-link); aqui so
// varre em lote e grava cada resultado em download_link_check.
const SCHEDULE = '0 3 * * *'; // 03:00 diario (horario de baixo trafego)

// Chave arbitraria estavel para lock (pg_try_advisory_lock usa bigint).
// Garante 1 execucao mesmo com N replicas do backend, sem depender de infra
// nova (Redis) — usa o Postgres ja compartilhado pelo modulo.
const ADVISORY_LOCK_KEY = 827_501_003;

export async function runScheduledLinkCheck(): Promise<{ checked: number; unhealthy: number }> {
  const lockRow = await db
    .selectNoFrom((eb) => eb.fn<boolean>('pg_try_advisory_lock', [eb.val(ADVISORY_LOCK_KEY)]).as('acquired'))
    .executeTakeFirstOrThrow();

  if (!lockRow.acquired) {
    return { checked: 0, unhealthy: 0 };
  }

  try {
    const materials = await db
      .selectFrom('download_material')
      .select(['id', 'external_url'])
      .where('editorial_state', '=', 'published')
      .where('external_url', 'is not', null)
      .execute();

    let checked = 0;
    let unhealthy = 0;

    for (const material of materials) {
      if (!material.external_url) continue;

      const result = await checkLink(material.external_url);
      checked += 1;
      if (!result.isHealthy) unhealthy += 1;

      await db
        .insertInto('download_link_check')
        .values({
          material_id: material.id,
          checked_url: result.checkedUrl,
          http_status: result.httpStatus,
          is_healthy: result.isHealthy,
          error_detail: result.errorDetail,
        })
        .execute();
    }

    return { checked, unhealthy };
  } finally {
    await db.selectNoFrom((eb) => eb.fn('pg_advisory_unlock', [eb.val(ADVISORY_LOCK_KEY)]).as('released')).execute();
  }
}

export function startLinkCheckerScheduler(): void {
  cron.schedule(
    SCHEDULE,
    () => {
      runScheduledLinkCheck()
        .then(({ checked, unhealthy }) => {
          console.log(`[link-checker-scheduler] checados=${checked} degradados=${unhealthy}`);
        })
        .catch((error: unknown) => {
          console.error('[link-checker-scheduler] falha na varredura agendada:', error);
        });
    },
    { timezone: 'America/Sao_Paulo', noOverlap: true },
  );
}
