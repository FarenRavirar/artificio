import type { Kysely, Transaction } from "kysely";
import type { Database } from "./db.js";
import { isModerationEvent } from "./notificationPreference.js";

// ============================================================================
// T3.15 — Outbox de entrega de notificação (requisito 13c-i)
//
// Evento entra na transação da ação de mérito; fan-out roda FORA dela.
// recipients armazenados como JSONB no outbox — resolvidos uma vez
// na transação, consumidos depois. Reprocessamento idempotente via
// ON CONFLICT DO NOTHING no UNIQUE (realm, source_app, event_id,
// recipient_user_id) do recibo (migration_006:514).
// ============================================================================

export interface EnqueueParams {
  realm: string;
  sourceApp: string;
  eventRowId: string;
  recipients: string[];
}

/**
 * Insere no outbox DENTRO da transação. Evento já foi inserido antes.
 * Rollback da transação elimina o outbox junto — atômico.
 */
export async function enqueueOutboxEvent(
  trx: Transaction<Database>,
  params: EnqueueParams,
): Promise<void> {
  await trx
    .insertInto("notification_outbox")
    .values({
      realm: params.realm,
      source_app: params.sourceApp,
      event_id: params.eventRowId,
      recipients: JSON.stringify(params.recipients),
    })
    .execute();
}

/**
 * Fan-out de um evento do outbox: lê recipients, aplica preferências
 * (T3.11b) e cria recibos. Idempotente: INSERT individual com try/catch
 * para duplicata de UNIQUE.
 */
export async function processOutboxEntry(
  db: Kysely<Database>,
  entry: { id: string; realm: string; source_app: string; event_id: string },
): Promise<number> {
  // 1. Lê o evento
  const event = await db
    .selectFrom("notification_event")
    .select(["event_type"])
    .where("id", "=", entry.event_id)
    .where("realm", "=", entry.realm)
    .where("source_app", "=", entry.source_app)
    .executeTakeFirst();

  if (!event) {
    // Evento sumiu (não deveria — mesma transação). Marca processado.
    await db
      .updateTable("notification_outbox")
      .set({ processed_at: new Date() })
      .where("id", "=", entry.id)
      .execute();
    return 0;
  }

  // 2. Lê recipients do outbox
  const outbox = await db
    .selectFrom("notification_outbox")
    .select("recipients")
    .where("id", "=", entry.id)
    .executeTakeFirst();

  const recipients: string[] = Array.isArray(outbox?.recipients)
    ? (outbox!.recipients as unknown as string[])
    : [];

  if (recipients.length === 0) {
    await db
      .updateTable("notification_outbox")
      .set({ processed_at: new Date() })
      .where("id", "=", entry.id)
      .execute();
    return 0;
  }

  // 3. Filtro de preferência (T3.11b)
  const isModeration = isModerationEvent(event.event_type);
  let deliverable: string[] = recipients;

  if (!isModeration) {
    const prefs = await db
      .selectFrom("notification_preference")
      .select(["user_id"])
      .where("user_id", "in", recipients)
      .where("event_type", "=", event.event_type)
      .where("enabled", "=", false)
      .execute();

    const disabled = new Set(prefs.map((p) => p.user_id));
    deliverable = recipients.filter((uid) => !disabled.has(uid));
  }

  // 4. Cria recibos (idempotente via try/catch no UNIQUE)
  let created = 0;
  const now = new Date();
  for (const recipientUserId of deliverable) {
    try {
      await db
        .insertInto("notification_receipt")
        .values({
          realm: entry.realm,
          source_app: entry.source_app,
          event_id: entry.event_id,
          recipient_user_id: recipientUserId,
          read_at: null,
          created_at: now,
        })
        .execute();
      created++;
    } catch {
      // Duplicata → skip (idempotência do UNIQUE)
    }
  }

  // 5. Marca outbox como processado
  await db
    .updateTable("notification_outbox")
    .set({ processed_at: new Date() })
    .where("id", "=", entry.id)
    .execute();

  return created;
}

/**
 * Processa todas as pendências (limitado a 100 por chamada).
 * Chamado após commit da transação e por sweep periódico.
 */
export async function processOutboxPending(
  db: Kysely<Database>,
): Promise<number> {
  const pending = await db
    .selectFrom("notification_outbox")
    .select(["id", "realm", "source_app", "event_id"])
    .where("processed_at", "is", null)
    .orderBy("created_at", "asc")
    .limit(100)
    .execute();

  let total = 0;
  for (const entry of pending) {
    try {
      total += await processOutboxEntry(db, entry);
    } catch {
      // Uma falha não bloqueia as outras
    }
  }

  return total;
}

/**
 * Cria recibos inline (DENTRO da transação). Usado pelo fluxo existente
 * em communityCommentWrite.ts, que já roda na transação.
 *
 * Preferências NÃO são aplicadas aqui — o filtro é aplicado no fan-out
 * do outbox (T3.11b decide no ponto de entrega, T3.15).
 */
export async function createReceiptsInline(
  trx: Transaction<Database>,
  params: {
    realm: string;
    sourceApp: string;
    eventRowId: string;
    recipients: string[];
  },
): Promise<number> {
  const { realm, sourceApp, eventRowId, recipients } = params;
  if (recipients.length === 0) return 0;

  let created = 0;
  for (const recipientUserId of recipients) {
    try {
      await trx
        .insertInto("notification_receipt")
        .values({
          realm,
          source_app: sourceApp,
          event_id: eventRowId,
          recipient_user_id: recipientUserId,
          read_at: null,
          created_at: new Date(),
        })
        .execute();
      created++;
    } catch {
      // Duplicate → skip
    }
  }

  return created;
}
