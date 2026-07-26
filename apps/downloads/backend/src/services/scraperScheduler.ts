import cron from 'node-cron';
import { db } from '../db';
import { withAdvisoryLock } from './advisoryLock';
import { executeScraperRun } from '../routes/scraper';
import type { DownloadSourcePlatform } from '../db/types';

// T5.4 (spec 084) — cron diario SO nas fontes sem anti-bot conhecido
// (D119/spec — DriveThruRPG/DMs Guild NUNCA entram aqui, so disparo manual
// via POST /admin/scraper/run). Spec 085 (Fase 6, T6.3): lista deixa de
// ser hardcode, vem do registry (download_scraper_platform.supports_auto_scrape)
// — admin cadastra plataforma nova com a flag e o cron passa a rodar sem
// deploy. Cron so roda fonte com adapter real de qualquer forma
// (executeScraperRun falha explicito se supports_auto_scrape=TRUE sem
// entrada em ADAPTERS, scraper.ts:43-50).
const SCHEDULE = '0 4 * * *'; // 04:00 diario (apos link-checker as 03:00)
const ADVISORY_LOCK_KEY = 827_501_004;

async function getCronSourcePlatforms(): Promise<DownloadSourcePlatform[]> {
  const rows = await db
    .selectFrom('download_scraper_platform')
    .select('slug')
    .where('supports_auto_scrape', '=', true)
    .execute();
  return rows.map((row) => row.slug);
}
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
  // Advisory lock TRANSACIONAL via helper compartilhado (achado de review PR
  // #214, Codex P2): o par `pg_try_advisory_lock`/`pg_advisory_unlock` de
  // sessao podia cair em conexoes diferentes do pg.Pool, e nesse caso o unlock
  // nao liberava o lock — o cron ficava travado ate a conexao original morrer.
  // `pg_try_advisory_xact_lock` e liberado pelo proprio Postgres no fim da
  // transacao, sem unlock explicito que possa vazar.
  const triggered = await withAdvisoryLock(ADVISORY_LOCK_KEY, async () => {
    const executed: DownloadSourcePlatform[] = [];
    const cronSourcePlatforms = await getCronSourcePlatforms();
    for (const sourcePlatform of cronSourcePlatforms) {
      // A run e gravada com a conexao GLOBAL, nunca com a transacao do lock
      // (achado de review PR #214, Codex P1): executeScraperRun roda em outra
      // conexao e escreve log com FK, contadores e status por conta propria —
      // se a run so existisse dentro da transacao ainda aberta, essa outra
      // conexao nao a enxergaria, os logs quebrariam por FK e a run ficaria
      // presa em `running` pra sempre. Mesmo padrao da rota manual
      // (routes/scraper.ts POST /run), que ja gravava fora de transacao.
      //
      // O lock continua cobrindo o cron inteiro: ele impede DUAS EXECUCOES
      // concorrentes do agendador, que e o seu proposito — nao precisa (nem
      // deve) envolver a escrita da run.
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
        // pendurada em segundo plano, mas o cron segue pras proximas fontes,
        // nunca trava o scheduler inteiro).
        console.error(`[scraper-scheduler] ${sourcePlatform} excedeu deadline ou falhou:`, error instanceof Error ? error.message : error);
      }
      executed.push(sourcePlatform);
    }
    return executed;
  });

  // `null` = lock ocupado (outra replica ja esta rodando): nada disparado.
  return { triggered: triggered ?? [] };
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
