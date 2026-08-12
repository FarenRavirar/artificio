import { fetch as undiciFetch } from 'undici';
import { db } from '../db';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

// ============================================================================
// T3.5/T3.13 (spec 090, requisitos 13c-i e 13a-i) — entrega do outbox local
//
// Lê `download_notification_outbox` (migration_038) e faz
// `POST /internal/v1/notifications/events` no `accounts.`. Roda FORA da
// transação de moderação: é essa separação que impede falha de notificação de
// reverter aprovação/rejeição/decisão de denúncia.
//
// Mesmo transporte já usado por `accountsClient.ts` (undici explícito,
// `X-Service-Token` com credencial registrada), agora com escopo
// `notification.write` — separado de `users.read` porque um módulo que emite
// aviso não precisa poder resolver e-mail de qualquer usuário.
// ============================================================================

const REQUEST_TIMEOUT_MS = 5000;

/** Teto por varredura. Lote grande de moderação não vira uma rajada só. */
const BATCH_SIZE = 50;

/**
 * Depois disso a entrada para de ser tentada e fica registrada com o último
 * erro. Sem teto, um evento com payload permanentemente inválido (400) seria
 * retentado para sempre e empurraria a fila inteira.
 */
const MAX_ATTEMPTS = 5;

export interface DeliveryResult {
  delivered: number;
  failed: number;
  skipped: number;
}

function isUuidArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Normaliza JSONB vindo do banco. `unknown` até passar por checagem tipada
 * (AGENTS.md §Regras Gerais de Código): `recipients` malformado quebraria o
 * corpo do POST com erro fora de qualquer try.
 */
function normalizeSnapshot(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function deliverPendingNotifications(
  database: Kysely<Database> = db,
): Promise<DeliveryResult> {
  const baseUrl = process.env.ACCOUNTS_URL;
  const serviceCredential = process.env.SERVICE_CREDENTIAL || undefined;

  if (!baseUrl || !serviceCredential) {
    // Mesmo comportamento de `accountsClient.ts:29`: avisa e não lança. A
    // entrada fica pendente e sai na próxima varredura quando a configuração
    // existir — nada se perde por falta de env.
    console.warn('[notificationOutboxDelivery] ACCOUNTS_URL ou SERVICE_CREDENTIAL não configurado — entrega adiada.');
    return { delivered: 0, failed: 0, skipped: 0 };
  }

  const pending = await database
    .selectFrom('download_notification_outbox')
    .selectAll()
    .where('delivered_at', 'is', null)
    .where('attempt_count', '<', MAX_ATTEMPTS)
    .orderBy('created_at', 'asc')
    .limit(BATCH_SIZE)
    .execute();

  const result: DeliveryResult = { delivered: 0, failed: 0, skipped: 0 };

  for (const entry of pending) {
    const recipients = entry.recipients;
    if (!isUuidArray(recipients) || recipients.length === 0) {
      // Payload que o `accounts.` recusaria com 400 em toda tentativa. Marca
      // entregue com erro registrado em vez de retentar cinco vezes o que não
      // tem como dar certo — e o `last_error` deixa o caso auditável.
      await database
        .updateTable('download_notification_outbox')
        .set({ delivered_at: new Date(), last_error: 'recipients inválido' })
        .where('id', '=', entry.id)
        .execute();
      result.skipped++;
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await undiciFetch(`${baseUrl}/internal/v1/notifications/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': serviceCredential,
        },
        body: JSON.stringify({
          event_id: entry.event_id,
          event_type: entry.event_type,
          event_version: entry.event_version,
          subject_type: entry.subject_type,
          subject_id: entry.subject_id,
          canonical_path: entry.canonical_path,
          snapshot: normalizeSnapshot(entry.snapshot),
          recipients,
          // Momento real do fato no `downloads`, não o da entrega. É o caso que
          // 19b (`spec.md:282`) previu ao exigir índice por `occurred_at` do
          // evento: sem isto, um sweep atrasado ordenaria os avisos pela hora
          // em que a fila esvaziou, não pela hora em que a moderação decidiu.
          occurred_at: entry.created_at.toISOString(),
        }),
        signal: controller.signal,
      });

      if (response.status === 202 || response.status === 200) {
        await database
          .updateTable('download_notification_outbox')
          .set({ delivered_at: new Date(), last_error: null })
          .where('id', '=', entry.id)
          .execute();
        result.delivered++;
        continue;
      }

      // 4xx não melhora com retry (payload inválido, escopo faltando); 5xx sim.
      // Contar tentativa nos dois casos mantém o teto valendo para ambos.
      const permanent = response.status >= 400 && response.status < 500;
      await database
        .updateTable('download_notification_outbox')
        .set({
          attempt_count: permanent ? MAX_ATTEMPTS : entry.attempt_count + 1,
          last_error: `HTTP ${response.status}`,
        })
        .where('id', '=', entry.id)
        .execute();
      result.failed++;
    } catch (error: unknown) {
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : String(error);
      await database
        .updateTable('download_notification_outbox')
        .set({ attempt_count: entry.attempt_count + 1, last_error: reason })
        .where('id', '=', entry.id)
        .execute();
      result.failed++;
    } finally {
      clearTimeout(timeout);
    }
  }

  return result;
}

/** Intervalo do sweep. Mesmo valor do sweep do `accounts` (T3.15). */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export function startNotificationOutboxSweep(
  database: Kysely<Database> = db,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    void deliverPendingNotifications(database).catch((error: unknown) => {
      console.error('[notificationOutboxDelivery] falha na varredura periódica:', error);
    });
  }, SWEEP_INTERVAL_MS);

  // `unref` para o timer não segurar o processo no encerramento — sem isso, o
  // container demoraria até 5 min para sair em cada deploy.
  timer.unref();
  return timer;
}
