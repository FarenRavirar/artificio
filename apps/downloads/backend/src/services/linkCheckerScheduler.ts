import cron from 'node-cron';
import { db } from '../db';
import { checkLink } from './linkChecker';

// T2.7 (spec 082) — DEB-075-01 fechado: job agendado interno (node-cron, sem
// dependencia de infra CI externa), roda 1x/dia checando o link de todo
// material publicado com external_url. Mesma logica de checkLink ja usada
// pelo endpoint sob demanda (POST /admin/materials/:id/check-link); aqui so
// varre em lote e grava cada resultado em download_link_check.
const SCHEDULE = '0 3 * * *'; // 03:00 diario (horario de baixo trafego)

export async function runScheduledLinkCheck(): Promise<{ checked: number; unhealthy: number }> {
  const materials = await db
    .selectFrom('download_material')
    .select(['id', 'external_url'])
    .where('editorial_state', '=', 'published')
    .where('external_url', 'is not', null)
    .execute();

  let unhealthy = 0;

  for (const material of materials) {
    if (!material.external_url) continue;

    const result = await checkLink(material.external_url);
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

  return { checked: materials.length, unhealthy };
}

export function startLinkCheckerScheduler(): void {
  cron.schedule(SCHEDULE, () => {
    runScheduledLinkCheck()
      .then(({ checked, unhealthy }) => {
        console.log(`[link-checker-scheduler] checados=${checked} degradados=${unhealthy}`);
      })
      .catch((error: unknown) => {
        console.error('[link-checker-scheduler] falha na varredura agendada:', error);
      });
  });
}
