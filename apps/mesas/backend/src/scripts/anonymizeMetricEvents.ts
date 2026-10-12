import { db } from '../db/index.js';
import { METRIC_THROTTLE_WINDOWS } from '../services/tableMetrics.js';

/**
 * Anonimiza eventos de métrica antigos em `table_metric_events`.
 *
 * Spec 105 M2: a tabela é a série temporal de view/click/contact/favorite por
 * mesa. A versão anterior deste script APAGAVA todo evento com mais de 48 h, o
 * que destruiria a série (nunca rodou: não estava no `cronRunner`, e os eventos
 * de 2026-04-07 seguiam no banco em 2026-10-12). O fingerprint (hash de IP+UA)
 * só serve para o dedupe; passada a maior janela, ele é dado pessoal sem uso.
 * Aqui ele vira `NULL` e a linha fica (migration_168).
 *
 * Uso: `npm run metrics:anonymize` (dist) ou `metrics:anonymize:dev`.
 */

const RETENTION_HOURS = 48;

async function anonymizeOldMetricEvents(): Promise<void> {
  // A retenção precisa cobrir a maior janela de dedupe, ou o visitante que
  // voltou dentro da janela seria contado de novo.
  const maxWindowMs = Math.max(...Object.values(METRIC_THROTTLE_WINDOWS));
  if (RETENTION_HOURS * 60 * 60 * 1000 <= maxWindowMs) {
    throw new Error(`RETENTION_HOURS (${RETENTION_HOURS}) não cobre a maior janela de dedupe (${maxWindowMs} ms).`);
  }

  const cutoffDate = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
  const result = await db
    .updateTable('table_metric_events')
    .set({ fingerprint_hash: null })
    .where('created_at', '<', cutoffDate)
    .where('fingerprint_hash', 'is not', null)
    .executeTakeFirst();

  console.log(
    `[metrics:anonymize] ${Number(result.numUpdatedRows ?? 0)} eventos anonimizados (antes de ${cutoffDate.toISOString()})`,
  );
}

anonymizeOldMetricEvents()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[metrics:anonymize] Erro:', error);
    process.exit(1);
  });
