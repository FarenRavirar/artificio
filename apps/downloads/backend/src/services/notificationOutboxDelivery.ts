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

/**
 * Validade do claim. Precisa cobrir o pior caso de uma varredura inteira
 * (`BATCH_SIZE` × `REQUEST_TIMEOUT_MS` = 250s) com folga, senão o lease expira
 * enquanto o worker ainda está entregando e um segundo worker pega as mesmas
 * linhas. Curto o bastante para que worker morto não prenda a fila por muito
 * tempo.
 */
const CLAIM_LEASE_MS = 10 * 60 * 1000;

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

  // Claim atômico antes de qualquer HTTP.
  //
  // `FOR UPDATE SKIP LOCKED` (o que o sweep do `accounts` usa) não serve aqui:
  // ele segura o lock pela transação inteira, e esta entrega faz chamada de
  // rede no meio — a transação ficaria aberta durante o timeout de 5s por
  // entrada. Um `SELECT` sem claim é pior ainda: o disparo pós-commit e o sweep
  // periódico rodam concorrentes por construção (moderação em lote dispara os
  // dois), então os dois leriam as MESMAS linhas e entregariam cada aviso duas
  // vezes. A idempotência por `event_id` no `accounts.` impede o aviso
  // duplicado, mas não impede o trabalho duplicado nem o 429 que ele provoca.
  //
  // O `UPDATE ... RETURNING` com sub-select resolve os dois: um único comando
  // marca e devolve as linhas, e o segundo worker não enxerga o que o primeiro
  // acabou de reservar. `claimed_until` é lease com prazo — worker que morre no
  // meio não prende a entrada para sempre, ela volta à fila quando o lease
  // expira.
  const claimedUntil = new Date(Date.now() + CLAIM_LEASE_MS);
  const now = new Date();

  const pending = await database
    .updateTable('download_notification_outbox')
    .set({ claimed_until: claimedUntil })
    .where('id', 'in', (eb) =>
      eb
        .selectFrom('download_notification_outbox')
        .select('id')
        .where('delivered_at', 'is', null)
        .where('attempt_count', '<', MAX_ATTEMPTS)
        .where((inner) =>
          inner.or([
            inner.eb('claimed_until', 'is', null),
            inner.eb('claimed_until', '<', now),
          ]),
        )
        .orderBy('created_at', 'asc')
        .limit(BATCH_SIZE),
    )
    .returningAll()
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
        .set({ delivered_at: new Date(), last_error: 'recipients inválido', claimed_until: null })
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
          .set({ delivered_at: new Date(), last_error: null, claimed_until: null })
          .where('id', '=', entry.id)
          .execute();
        result.delivered++;
        continue;
      }

      // 4xx não melhora com retry (payload inválido, escopo faltando); 5xx sim.
      // Contar tentativa nos dois casos mantém o teto valendo para ambos.
      //
      // Só esgota o teto o que é comprovadamente defeito do payload — 400 e
      // 422. Todo o resto do 4xx descreve o *ambiente*, não a mensagem, e o
      // ambiente muda sozinho:
      //
      // - `401`/`403`: credencial em rotação, ainda não emitida, ou sem
      //   `notification.write` até a migration 011 rodar. Corrigida a
      //   configuração, a mesma entrega passa.
      // - `404`: durante deploy escalonado o `accounts.` antigo ainda não tem
      //   a rota de ingestão. O deploy termina e a rota aparece.
      // - `429`: a rota passa por `communityRateLimit`
      //   (`accounts/src/communityRateLimit.ts:240`), e um lote de até 50
      //   entregas estoura o bucket da credencial com facilidade.
      // - `408`: timeout declarado pelo servidor é transitório por definição.
      //
      // Tratar qualquer um deles como terminal gravaria `attempt_count = 5` e
      // o aviso nunca mais voltaria ao sweep — perda silenciosa causada por
      // uma janela de operação que já passou (achado de review, PR #257).
      const permanentPayloadError = response.status === 400 || response.status === 422;
      const permanent = permanentPayloadError;

      // Falha de configuração se parece com falha transitória e consome as 5
      // tentativas em silêncio. Log explícito para o operador ver a causa antes
      // de a entrada esgotar o teto — sem isto, o sintoma só aparece como aviso
      // que nunca chegou.
      if (response.status === 401 || response.status === 403) {
        console.error(
          `[notificationOutboxDelivery] HTTP ${response.status} — credencial de serviço ausente, revogada ou sem escopo notification.write. Tentativa ${entry.attempt_count + 1}/${MAX_ATTEMPTS}.`,
        );
      }
      await database
        .updateTable('download_notification_outbox')
        .set({
          attempt_count: permanent ? MAX_ATTEMPTS : entry.attempt_count + 1,
          last_error: `HTTP ${response.status}`,
          // Libera o claim: a entrada volta à fila na próxima varredura em vez
          // de esperar o lease inteiro expirar.
          claimed_until: null,
        })
        .where('id', '=', entry.id)
        .execute();
      result.failed++;
    } catch (error: unknown) {
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : String(error);
      await database
        .updateTable('download_notification_outbox')
        .set({ attempt_count: entry.attempt_count + 1, last_error: reason, claimed_until: null })
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
