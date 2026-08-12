import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "./db.js";
import { enrichNotificationItem } from "./notificationFormatter.js";

// ============================================================================
// T3.6 — Queries de notificação (extraídas das rotas para teste isolado).
//
// Cada função recebe o Kysely e os parâmetros; as rotas em notificationRoutes.ts
// chamam estas funções, que podem ser mockadas nos testes de rota e testadas
// diretamente nos testes SQL.
// ============================================================================

export interface NotificationItem {
  id: string;
  event_id: string;
  event_type: string;
  subject_type: string;
  subject_id: string;
  source_app: string;
  source_label: string;
  canonical_path: string;
  snapshot: unknown;
  /** `unknown` já cobre `null` — mantém sem `| null` redundante. */
  metadata: unknown;
  text: string;
  link: string | null;
  occurred_at: string;
  read_at: string | null;
  created_at: string;
}

export interface ListNotificationsParams {
  realm: string;
  userId: string;
  limit: number;
  sourceApp?: string;
  /** Cursor decodificado: { occurredAt: ISO string, id: UUID string } */
  cursor?: { occurredAt: string; id: string } | null;
}

export interface ListNotificationsResult {
  items: NotificationItem[];
  cursor: string | null;
}

export async function countUnread(
  db: Kysely<Database>,
  realm: string,
  userId: string,
  sourceApp?: string,
): Promise<number> {
  let query = db
    .selectFrom("notification_receipt")
    .select(db.fn.countAll<number>().as("count"))
    .where("realm", "=", realm)
    .where("recipient_user_id", "=", userId)
    .where("read_at", "is", null);

  if (sourceApp) {
    query = query.where("source_app", "=", sourceApp);
  }

  const row = await query.executeTakeFirstOrThrow();
  // pg devolve COUNT(*) (int8) como string por padrão — converter antes de expor.
  return Number(row.count);
}

export async function markAllRead(
  db: Kysely<Database>,
  realm: string,
  userId: string,
): Promise<number> {
  const result = await db
    .updateTable("notification_receipt")
    .set({ read_at: new Date() })
    .where("realm", "=", realm)
    .where("recipient_user_id", "=", userId)
    .where("read_at", "is", null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) || 0;
}

export async function markReadThrough(
  db: Kysely<Database>,
  realm: string,
  userId: string,
  throughDate: Date,
): Promise<number> {
  const result = await db
    .updateTable("notification_receipt as r")
    .innerJoin("notification_event as e", (join) =>
      join
        .onRef("e.realm", "=", "r.realm")
        .onRef("e.source_app", "=", "r.source_app")
        .onRef("e.id", "=", "r.event_id"),
    )
    .set({ read_at: new Date() })
    .where("r.realm", "=", realm)
    .where("r.recipient_user_id", "=", userId)
    .where("r.read_at", "is", null)
    .where("e.occurred_at", "<=", throughDate)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) || 0;
}

/**
 * Encontra um recibo e devolve o `recipient_user_id` para checagem de ownership.
 * Devolve `null` para ID inexistente — o caller decide código HTTP.
 */
export async function findReceiptOwner(
  db: Kysely<Database>,
  realm: string,
  receiptId: string,
): Promise<string | null> {
  const row = await db
    .selectFrom("notification_receipt")
    .select("recipient_user_id")
    .where("realm", "=", realm)
    .where("id", "=", receiptId)
    .executeTakeFirst();
  return row?.recipient_user_id ?? null;
}

export async function markOneRead(
  db: Kysely<Database>,
  realm: string,
  receiptId: string,
  userId: string,
): Promise<void> {
  await db
    .updateTable("notification_receipt")
    .set({ read_at: new Date() })
    .where("realm", "=", realm)
    .where("id", "=", receiptId)
    .where("recipient_user_id", "=", userId)
    .execute();
}

export async function listNotifications(
  db: Kysely<Database>,
  params: ListNotificationsParams,
): Promise<ListNotificationsResult> {
  const { realm, userId, limit, sourceApp, cursor } = params;

  // Base: recibo JOIN evento.
  // LEFT JOIN community_comment pelo comment_id do snapshot para aplicar
  // o filtro do requisito 17e (social de alvo removido some).
  let query = db
    .selectFrom("notification_receipt as r")
    .innerJoin("notification_event as e", (join) =>
      join
        .onRef("e.realm", "=", "r.realm")
        .onRef("e.source_app", "=", "r.source_app")
        .onRef("e.id", "=", "r.event_id"),
    )
    .leftJoin("community_comment as c", (join) =>
      join
        .onRef("c.realm", "=", "e.realm")
        .onRef("c.source_app", "=", "e.source_app")
        // Guarda local: CHECK migration_006 valida em escrita, mas o cast
        // aqui protege contra snapshot malformado de produtor externo.
        .on(
          sql`e.snapshot->>'comment_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
          "=",
          sql`true`,
        )
        .on("c.id", "=", sql`(e.snapshot->>'comment_id')::uuid`),
    )
    .select([
      "r.id as receipt_id",
      "r.event_id",
      "r.read_at",
      "r.created_at as receipt_created_at",
      "e.event_type",
      "e.subject_type",
      "e.subject_id",
      "e.source_app",
      "e.canonical_path",
      "e.snapshot",
      "e.metadata",
      "e.occurred_at",
      "e.id as event_row_id",
    ])
    .where("r.realm", "=", realm)
    .where("r.recipient_user_id", "=", userId);

  // ---- filtro do requisito 17e ----
  // Aviso social de alvo removido some; aviso de moderação nunca sai.
  // O filtro entra ANTES do corte do cursor — senão página fica curta.
  query = query.where((eb) =>
    eb.or([
      eb("e.event_type", "like", "moderation.%"),
      eb.and([
        eb("e.event_type", "in", ["comment.created", "comment.replied"]),
        eb.or([
          eb("c.visibility_state", "in", [
            "visible" as const,
            "pending_review_hidden" as const,
          ]),
          eb("c.id", "is", null),
        ]),
      ]),
      eb.and([
        eb("e.event_type", "not in", ["comment.created", "comment.replied"]),
        eb("e.event_type", "not like", "moderation.%"),
      ]),
    ]),
  );

  if (sourceApp) {
    query = query.where("e.source_app", "=", sourceApp);
  }

  // Cursor
  if (cursor) {
    const cursorDate = new Date(cursor.occurredAt);
    query = query.where((eb) =>
      eb.or([
        eb("e.occurred_at", "<", cursorDate),
        eb.and([
          eb("e.occurred_at", "=", cursorDate),
          eb("e.id", "<", cursor.id),
        ]),
      ]),
    );
  }

  const rows = (await query
    .orderBy("e.occurred_at", "desc")
    .orderBy("e.id", "desc")
    .limit(limit + 1)
    .execute()) as NotificationRow[];

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  const items: NotificationItem[] = page.map((row) => {
    const enriched = enrichNotificationItem({
      event_type: row.event_type,
      source_app: row.source_app,
      canonical_path: row.canonical_path,
    });
    return {
      id: row.receipt_id,
      event_id: row.event_id,
      event_type: row.event_type,
      subject_type: row.subject_type,
      subject_id: row.subject_id,
      source_app: row.source_app,
      source_label: enriched.source_label,
      canonical_path: row.canonical_path,
      snapshot: row.snapshot,
      metadata: row.metadata,
      text: enriched.text,
      link: enriched.link,
      occurred_at: row.occurred_at.toISOString(),
      read_at: row.read_at?.toISOString() ?? null,
      created_at: row.receipt_created_at.toISOString(),
    };
  });

  const nextCursor =
    hasMore && page.length > 0
      ? Buffer.from(
          JSON.stringify({
            t: rows[limit - 1].occurred_at.toISOString(),
            i: rows[limit - 1].event_row_id,
          }),
        ).toString("base64url")
      : null;

  return { items, cursor: nextCursor };
}

// ---- tipos internos ----

interface NotificationRow {
  receipt_id: string;
  event_id: string;
  read_at: Date | null;
  receipt_created_at: Date;
  event_type: string;
  subject_type: string;
  subject_id: string;
  source_app: string;
  canonical_path: string;
  snapshot: unknown;
  metadata: unknown;
  occurred_at: Date;
  event_row_id: string;
}
