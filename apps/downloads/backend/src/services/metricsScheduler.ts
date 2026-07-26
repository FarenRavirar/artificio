import cron from 'node-cron';
import { withAdvisoryLock } from './advisoryLock';
import { purgeStaleViewDedup } from './materialMetrics';

// Spec 087 — manutencao diaria das metricas de curadoria.
//
// Achado de review PR #214 (Codex, P2): purgeStaleViewDedup nao tinha chamador
// nenhum, entao download_material_view crescia sem limite mesmo com retencao
// curta declarada. Aqui ela ganha agendamento, no mesmo padrao de
// scraperScheduler.ts (node-cron + advisory lock + fail-soft) em vez de um
// mecanismo proprio: manutencao periodica do app inteiro fala uma lingua so.
const SCHEDULE = '30 4 * * *'; // 04:30 diario (apos link-checker 03:00 e scraper 04:00)

// Chave DISTINTA da do scraper (827_501_004): lock compartilhado faria o purge
// esperar o scraper (que pode levar minutos por fonte) sem motivo nenhum.
const ADVISORY_LOCK_KEY = 827_501_005;

/**
 * Roda o expurgo sob advisory lock transacional (services/advisoryLock.ts). O
 * lock e o que torna o agendamento seguro com mais de uma replica do
 * container: sem ele, N replicas disparariam o mesmo DELETE no mesmo minuto.
 * Quem nao pegar o lock sai em no-op (`purged: null`).
 *
 * O DELETE roda DENTRO da mesma transacao do lock — e o que garante que o
 * expurgo esta de fato protegido por ele.
 */
export async function runScheduledMetricsMaintenance(): Promise<{ purged: number | null }> {
  const purged = await withAdvisoryLock(ADVISORY_LOCK_KEY, (trx) => purgeStaleViewDedup(trx));
  return { purged };
}

export function startMetricsScheduler(): void {
  cron.schedule(
    SCHEDULE,
    () => {
      runScheduledMetricsMaintenance()
        .then(({ purged }) => {
          console.log(
            purged === null
              ? '[metrics-scheduler] expurgo ignorado (lock ocupado)'
              : `[metrics-scheduler] linhas de dedup expurgadas: ${purged}`,
          );
        })
        // Fail-soft igual ao resto das metricas: manutencao que falha nao pode
        // derrubar o processo do backend.
        .catch((error: unknown) => {
          console.error('[metrics-scheduler] falha na execução agendada:', error);
        });
    },
    { timezone: 'America/Sao_Paulo', noOverlap: true },
  );
}
