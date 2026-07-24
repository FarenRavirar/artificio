import cron from 'node-cron';
import { db } from '../db';
import { executeScraperRun } from '../routes/scraper';
import type { DownloadSourcePlatform } from '../db/types';

// T5.4 (spec 084) — cron diario SO nas fontes sem anti-bot conhecido
// (D119/spec — DriveThruRPG/DMs Guild NUNCA entram aqui, so disparo manual
// via POST /admin/scraper/run). RPG Gratis/Newton Rocha/Catarse ficam fora
// da lista abaixo por nao terem adapter implementado ainda (D-084-06/07/08)
// — cron so roda fonte com adapter real, nunca "tenta" fonte sem codigo.
const SCHEDULE = '0 4 * * *'; // 04:00 diario (apos link-checker as 03:00)
const ADVISORY_LOCK_KEY = 827_501_004;
const CRON_SOURCE_PLATFORMS: DownloadSourcePlatform[] = ['itch_io', 'grimorios_e_dados', 'opera_rpg'];

export async function runScheduledScraperCron(): Promise<{ triggered: DownloadSourcePlatform[] }> {
  const lockRow = await db
    .selectNoFrom((eb) => eb.fn<boolean>('pg_try_advisory_lock', [eb.val(ADVISORY_LOCK_KEY)]).as('acquired'))
    .executeTakeFirstOrThrow();

  if (!lockRow.acquired) {
    return { triggered: [] };
  }

  try {
    const triggered: DownloadSourcePlatform[] = [];
    for (const sourcePlatform of CRON_SOURCE_PLATFORMS) {
      const run = await db
        .insertInto('download_scraper_run')
        .values({ source_platform: sourcePlatform, trigger_kind: 'cron' })
        .returning('id')
        .executeTakeFirstOrThrow();

      // Sequencial (nao paralelo) — evita rajada simultanea contra multiplos
      // terceiros ao mesmo tempo, coerente com rate-limit de saida por fonte.
      await executeScraperRun(run.id, sourcePlatform);
      triggered.push(sourcePlatform);
    }
    return { triggered };
  } finally {
    await db.selectNoFrom((eb) => eb.fn('pg_advisory_unlock', [eb.val(ADVISORY_LOCK_KEY)]).as('released')).execute();
  }
}

export function startScraperScheduler(): void {
  cron.schedule(
    SCHEDULE,
    () => {
      runScheduledScraperCron()
        .then(({ triggered }) => {
          console.log(`[scraper-scheduler] fontes disparadas: ${triggered.join(', ') || 'nenhuma (lock ocupado)'}`);
        })
        .catch((error: unknown) => {
          console.error('[scraper-scheduler] falha na execução agendada:', error);
        });
    },
    { timezone: 'America/Sao_Paulo', noOverlap: true },
  );
}
