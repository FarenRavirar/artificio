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
  db: Kysely<Database> | Transaction<Database>,
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

  // JSONB vindo do banco: normaliza antes de usar. Elemento não-string
  // quebraria o `where(... "in", recipients)` abaixo com 22P02 fora de
  // qualquer try, deixando a entrada pendente pra sempre.
  const rawRecipients: unknown = outbox?.recipients;
  const recipients: string[] = Array.isArray(rawRecipients)
    ? rawRecipients.filter((value): value is string => typeof value === "string")
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

  // 4. Cria recibos (idempotente via ON CONFLICT DO NOTHING no UNIQUE).
  // Não usa try/catch: dentro de transação Postgres, erro de constraint
  // sem savepoint aborta a transação inteira — o catch do JS captura a
  // exceção, mas o próximo INSERT na mesma trx falharia com
  // "current transaction is aborted".
  let created = 0;
  const now = new Date();
  for (const recipientUserId of deliverable) {
    const result = await db
      .insertInto("notification_receipt")
      .values({
        realm: entry.realm,
        source_app: entry.source_app,
        event_id: entry.event_id,
        recipient_user_id: recipientUserId,
        read_at: null,
        created_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["realm", "source_app", "event_id", "recipient_user_id"]).doNothing(),
      )
      .executeTakeFirst();
    if (Number(result.numInsertedOrUpdatedRows) > 0) created++;
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
 *
 * Select + processamento na MESMA transação com FOR UPDATE SKIP LOCKED:
 * sweeps concorrentes (pós-commit + periódico) não disputam as mesmas
 * linhas, cada um pega só o que os outros não travaram.
 */
export async function processOutboxPending(
  db: Kysely<Database>,
): Promise<number> {
  return db.transaction().execute(async (trx) => {
    const pending = await trx
      .selectFrom("notification_outbox")
      .select(["id", "realm", "source_app", "event_id"])
      .where("processed_at", "is", null)
      .orderBy("created_at", "asc")
      .limit(100)
      .forUpdate()
      .skipLocked()
      .execute();

    let total = 0;
    for (const entry of pending) {
      try {
        total += await processOutboxEntry(trx, entry);
      } catch (error) {
        // Uma falha não bloqueia as outras
        console.warn(
          `[notificationOutbox] falha ao processar entrada outbox=${entry.id}:`,
          error,
        );
      }
    }

    return total;
  });
}

