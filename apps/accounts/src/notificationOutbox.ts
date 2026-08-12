import { sql, type Kysely, type Transaction } from "kysely";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
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

  // JSONB vindo do banco: normaliza antes de usar. Elemento que não é
  // UUID válido quebraria o `where(... "in", recipients)` abaixo com
  // 22P02 fora de qualquer try, deixando a entrada pendente pra sempre
  // (achado CodeRabbit, PR #255 — string qualquer não bastava, precisa
  // ser UUID).
  const rawRecipients: unknown = outbox?.recipients;
  const recipients: string[] = Array.isArray(rawRecipients)
    ? rawRecipients.filter(
        (value): value is string => typeof value === "string" && isUuid(value),
      )
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

    // `Transaction<Database>` do Kysely 0.29 não expõe savepoint na API
    // pública — feito via SQL raw. Sem isso, um erro inesperado num entry
    // aborta a transação Postgres inteira: o catch abaixo capturaria a
    // exceção, mas todo entry seguinte falharia com "25P02 current
    // transaction is aborted" e seria contado como falha individual,
    // quando é cascata do primeiro erro (achado CodeRabbit, PR #255).
    let total = 0;
    for (const [index, entry] of pending.entries()) {
      const savepointName = `outbox_entry_${index}`;
      await sql`SAVEPOINT ${sql.raw(savepointName)}`.execute(trx);
      try {
        total += await processOutboxEntry(trx, entry);
        await sql`RELEASE SAVEPOINT ${sql.raw(savepointName)}`.execute(trx);
      } catch (error) {
        // Uma falha não bloqueia as outras — rollback só deste savepoint,
        // a transação segue viva para os próximos entries.
        await sql`ROLLBACK TO SAVEPOINT ${sql.raw(savepointName)}`.execute(trx);
        console.warn(
          `[notificationOutbox] falha ao processar entrada outbox=${entry.id}:`,
          error,
        );
        // Marca processado mesmo em falha: o passo 5 de processOutboxEntry
        // não roda quando a função lança (ex.: FK quebrada em recipients),
        // e o ROLLBACK TO desfaz qualquer coisa que tivesse rodado depois
        // do savepoint. Sem isso, entrada com erro permanente (recipient
        // que nunca vai existir) fica presa em retry infinito a cada
        // sweep — achado do teste real contra Postgres, PR #256.
        await trx
          .updateTable("notification_outbox")
          .set({ processed_at: new Date() })
          .where("id", "=", entry.id)
          .execute();
      }
    }

    return total;
  });
}

