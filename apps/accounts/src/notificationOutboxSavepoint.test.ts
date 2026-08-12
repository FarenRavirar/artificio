import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./db.js";
import { processOutboxPending } from "./notificationOutbox.js";

/**
 * T3.15 — Savepoint real do fan-out (achado CodeRabbit, PR #256).
 *
 * `processOutboxEntry` isolado (notificationOutbox.test.ts) prova a lógica
 * de negócio com mock, mas não prova que SAVEPOINT/RELEASE/ROLLBACK TO
 * funcionam de verdade dentro de `db.transaction().execute()` do Kysely —
 * `Transaction<Database>` do Kysely 0.29 não expõe `.savepoint()` na API
 * pública, e a implementação usa SQL raw (`notificationOutbox.ts:187-194`).
 * Erro de sintaxe ali só aparece contra Postgres real.
 *
 * Mesmo padrão de `communityWilson.test.ts`: roda quando há banco
 * (`COMMUNITY_TEST_DATABASE_URL`), pula sem falhar onde não há — o
 * monorepo não tem `pg-mem`/`testcontainers` (busca negativa em T2.3).
 *
 * Para rodar: `COMMUNITY_TEST_DATABASE_URL=postgres://... pnpm --filter @artificio/accounts test`
 */

const databaseUrl = process.env.COMMUNITY_TEST_DATABASE_URL;

const db = databaseUrl
  ? new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: databaseUrl }),
      }),
    })
  : undefined;

afterAll(async () => {
  await db?.destroy();
});

const REALM = "prod";
const SOURCE_APP = "downloads";
const EVENT_TYPE = "comment.replied";

async function insertUser(label: string): Promise<string> {
  const row = await db!
    .insertInto("users")
    .values({
      google_sub: `savepoint-test-${label}`,
      email: `${label}@savepoint.test`,
      name: "Savepoint Test User",
      avatar: null,
      role: "user",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function insertEvent(id: string): Promise<void> {
  await db!
    .insertInto("notification_event")
    .values({
      id,
      event_id: id,
      realm: REALM,
      source_app: SOURCE_APP,
      event_type: EVENT_TYPE,
      event_version: 1,
      subject_type: "downloads.material",
      subject_id: "mat-savepoint",
      canonical_path: "/materiais/mat-savepoint",
      snapshot: JSON.stringify({}),
    })
    .execute();
}

async function insertOutboxEntry(
  eventId: string,
  recipients: string[],
): Promise<void> {
  await db!
    .insertInto("notification_outbox")
    .values({
      realm: REALM,
      source_app: SOURCE_APP,
      event_id: eventId,
      recipients: JSON.stringify(recipients),
    })
    .execute();
}

async function cleanup(): Promise<void> {
  // `notification_event` é append-only (guard de banco recusa DELETE,
  // migration_006) — a suíte usa event_id gerado por execução em vez de
  // limpar essa tabela entre runs.
  await db!.deleteFrom("notification_outbox").where("source_app", "=", SOURCE_APP).execute();
  await db!.deleteFrom("notification_receipt").where("source_app", "=", SOURCE_APP).execute();
  await db!.deleteFrom("users").where("email", "like", "%@savepoint.test").execute();
}

describe.skipIf(!db)("processOutboxPending — savepoint real (T3.15)", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("isola falha de uma entrada sem abortar as demais na mesma transação", async () => {
    // userMissing nunca é inserido em `users` — o INSERT em
    // notification_receipt viola a FK
    // `recipient_user_id UUID NOT NULL REFERENCES users(id)`
    // (migration_006:508), erro real de Postgres, não simulado.
    const userOk1 = await insertUser("ok1");
    const userMissing = "99999999-9999-9999-9999-999999999999";
    const userOk3 = await insertUser("ok3");

    // Gerados por execução: notification_event é append-only, então IDs
    // fixos colidiriam com o UNIQUE (event_id) em qualquer segunda rodada.
    const eventOk1 = crypto.randomUUID();
    const eventFail = crypto.randomUUID();
    const eventOk3 = crypto.randomUUID();

    await insertEvent(eventOk1);
    await insertEvent(eventFail);
    await insertEvent(eventOk3);

    await insertOutboxEntry(eventOk1, [userOk1]);
    await insertOutboxEntry(eventFail, [userMissing]);
    await insertOutboxEntry(eventOk3, [userOk3]);

    const total = await processOutboxPending(db!);

    // Só 2 das 3 entradas produziram recibo — a do meio falhou e foi isolada.
    expect(total).toBe(2);

    const receipts = await db!
      .selectFrom("notification_receipt")
      .select(["event_id", "recipient_user_id"])
      .where("source_app", "=", SOURCE_APP)
      .execute();
    const receiptEventIds = receipts.map((r) => r.event_id).sort();
    expect(receiptEventIds).toStrictEqual([eventOk1, eventOk3].sort());

    // Todas as 3 entradas do outbox ficam marcadas como processadas — a
    // que falhou não deve ficar presa em loop infinito de retry.
    const outboxRows = await db!
      .selectFrom("notification_outbox")
      .select(["event_id", "processed_at"])
      .where("source_app", "=", SOURCE_APP)
      .execute();
    expect(outboxRows).toHaveLength(3);
    expect(outboxRows.every((r) => r.processed_at !== null)).toBe(true);
  });
});
