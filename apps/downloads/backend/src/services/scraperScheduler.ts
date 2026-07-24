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
// Achado de review PR #193 (codeRabbit, nitpick): deadline defensivo por
// fonte — sem isso, uma fonte travada (rede pendurada, subprocess Camoufox
// que nunca retorna) prende o advisory lock indefinidamente, bloqueando
// TODAS as execucoes seguintes do cron ate reinicio manual do processo.
const SOURCE_TIMEOUT_MS = 5 * 60_000;

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms excedido em ${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

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
      try {
        await withDeadline(executeScraperRun(run.id, sourcePlatform), SOURCE_TIMEOUT_MS, `scraper ${sourcePlatform}`);
      } catch (error: unknown) {
        // executeScraperRun ja grava status=failed em erro normal — aqui so
        // cobre o caso do deadline estourar (execucao real pode continuar
        // pendurada em segundo plano, mas o cron segue pras proximas fontes
        // e libera o lock, nunca trava o scheduler inteiro).
        console.error(`[scraper-scheduler] ${sourcePlatform} excedeu deadline ou falhou:`, error instanceof Error ? error.message : error);
      }
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
