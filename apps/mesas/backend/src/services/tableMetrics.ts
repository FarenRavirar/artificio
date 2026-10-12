import crypto from 'crypto';
import type { Request } from 'express';
import { sql, type Transaction } from 'kysely';
import { db } from '../db/index.js';
import type { Database } from '../db/types.js';

/**
 * Métricas próprias de mesa (view/click/contact/favorite) — fonte única.
 *
 * Spec 105 M1/M2. Antes, a lógica completa (dedupe por janela + linha em
 * `table_metric_events` + contador em `table_metrics`) vivia só nas rotas
 * `/api/v1/gm/tables/...` do `gmPanel`, que nenhum frontend chamava. As rotas
 * públicas que o frontend chama (`/api/v1/tables/:slug/view|click`) só
 * incrementavam o contador, sem dedupe e sem evento. Medido em produção
 * (2026-10-12): `table_metric_events` tinha 1 linha por ação, todas de
 * 2026-04-07, e `sum(contacts_count)` = 1 em 206 mesas. Sem evento não há série
 * temporal; sem rota de contato, o contador de contato nunca crescia.
 */
export const METRIC_THROTTLE_WINDOWS = {
  view: 15 * 60 * 1000,
  click: 5 * 60 * 1000,
  contact: 30 * 60 * 1000,
  favorite: 24 * 60 * 60 * 1000,
} as const;

export type MetricAction = keyof typeof METRIC_THROTTLE_WINDOWS;

const COUNTER_COLUMN = {
  view: 'views_count',
  click: 'clicks_count',
  contact: 'contacts_count',
  favorite: 'favorites_count',
} as const satisfies Record<MetricAction, string>;

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Hash de IP+UA. Só serve para deduplicar dentro da janela; nunca é exibido. */
export function generateFingerprint(req: Request): string {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex');
}

/**
 * Registra uma ação na mesa: evento (série temporal) + contador agregado, na
 * mesma transação. Repetição do mesmo visitante dentro da janela não conta.
 *
 * A checagem e a escrita ficam serializadas por um advisory lock de transação
 * na chave de dedupe (mesa + ação + fingerprint). Sem ele, duas requisições
 * simultâneas do mesmo visitante (clique duplo, retry paralelo) liam "nenhum
 * evento recente" antes de qualquer insert e contavam as duas: o índice da
 * migration 07 sobre `table_metric_events` não é único, e não pode ser, porque
 * a janela é de tempo (achado do Codex na PR #337). O lock é liberado no
 * commit/rollback e só bloqueia a mesma chave.
 *
 * `onCounted` roda na MESMA transação, só quando a ação contou — para escrita
 * que precisa andar junto com o contador (detalhamento de clique em
 * `table_click_events`). Fora da transação, falha nela deixava o clique contado
 * sem detalhamento e a rota respondendo 500 (achado do CodeRabbit na PR #338).
 */
export async function recordTableMetric(
  tableId: string,
  action: MetricAction,
  req: Request,
  onCounted?: (trx: Transaction<Database>) => Promise<void>,
): Promise<'counted' | 'throttled'> {
  const fingerprint = generateFingerprint(req);
  const column = COUNTER_COLUMN[action];
  const cutoff = new Date(Date.now() - METRIC_THROTTLE_WINDOWS[action]);

  return db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`table_metric:${tableId}:${action}:${fingerprint}`}, 0))`.execute(trx);

    const recentEvent = await trx
      .selectFrom('table_metric_events')
      .select('id')
      .where('table_id', '=', tableId)
      .where('action', '=', action)
      .where('fingerprint_hash', '=', fingerprint)
      .where('created_at', '>', cutoff)
      .executeTakeFirst();
    if (recentEvent) return 'throttled' as const;

    await trx
      .insertInto('table_metric_events')
      .values({ table_id: tableId, action, fingerprint_hash: fingerprint })
      .execute();

    await trx
      .insertInto('table_metrics')
      .values({ table_id: tableId, [column]: 1 })
      .onConflict((oc) =>
        oc.column('table_id').doUpdateSet({
          [column]: sql`table_metrics.${sql.ref(column)} + 1`,
          updated_at: sql`NOW()`,
        }),
      )
      .execute();

    if (onCounted) await onCounted(trx);
    return 'counted' as const;
  });
}
