import { randomUUID } from "node:crypto";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createComment, type CreateCommentInput } from "./communityCommentWrite.js";
import type { Database } from "./db.js";
import { listNotifications } from "./notificationData.js";

/**
 * T3.2 — prova integrada dos destinatários de comentário.
 *
 * Os testes puros de `resolveNotificationRecipients` fixam as combinações, mas
 * não provam que `createComment` persiste o conjunto resolvido nem que a central
 * lê exatamente esses recibos. Aqui o caminho é real: comentário + outbox +
 * recibo no PostgreSQL, seguido por `listNotifications`, sem mocks.
 *
 * Mesmo padrão de `communityWilson.test.ts` e
 * `notificationOutboxSavepoint.test.ts`: roda quando há banco
 * (`COMMUNITY_TEST_DATABASE_URL`) e se declara ausente onde não há.
 *
 * Para rodar: `COMMUNITY_TEST_DATABASE_URL=postgres://... pnpm --filter @artificio/accounts test`
 */

const databaseUrl = process.env.COMMUNITY_TEST_DATABASE_URL;

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;

const db = pool
  ? new Kysely<Database>({
      dialect: new PostgresDialect({
        pool,
      }),
    })
  : undefined;

afterAll(async () => {
  await db?.destroy();
});

const REALM = "prod";
const SOURCE_APP = "site";
const SUBJECT_TYPE = "site.post";

async function insertUser(label: string): Promise<string> {
  const nonce = randomUUID();
  const row = await db!
    .insertInto("users")
    .values({
      google_sub: `recipient-integration-${label}-${nonce}`,
      email: `${label}-${nonce}@recipient-integration.test`,
      name: `Recipient Integration ${label}`,
      avatar: null,
      role: "user",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

function commentInput(
  actingUserId: string,
  ownerUserId: string,
  subjectId: string,
  parentId: string | null = null,
): CreateCommentInput {
  return {
    realm: REALM,
    source_app: SOURCE_APP,
    subject_type: SUBJECT_TYPE,
    subject_id: subjectId,
    canonicalPath: `/posts/${subjectId}`,
    ownerUserId,
    parentId,
    bodyMarkdown: `Comentário integrado ${randomUUID()}`,
    actingUserId,
    idempotencyKey: `recipient-integration-${randomUUID()}`,
  };
}

async function create(input: CreateCommentInput): Promise<string> {
  const result = await createComment(db!, input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`createComment recusou: ${result.code}`);
  return result.comment.id;
}

async function notificationsFor(userId: string, subjectId: string) {
  const result = await listNotifications(db!, {
    realm: REALM,
    userId,
    limit: 100,
    sourceApp: SOURCE_APP,
  });
  return result.items.filter((item) => item.subject_id === subjectId);
}

async function waitForNotificationCount(
  userId: string,
  subjectId: string,
  expected: number,
) {
  await vi.waitFor(async () => {
    expect(await notificationsFor(userId, subjectId)).toHaveLength(expected);
  }, { timeout: 5_000 });
}

describe.skipIf(!pool)("destinatários persistidos de comentário (T3.2)", () => {
  it("raiz entrega ao publicador e exclui o ator", async () => {
    const publisher = await insertUser("root-publisher");
    const actor = await insertUser("root-actor");
    const subjectId = randomUUID();

    await create(commentInput(actor, publisher, subjectId));

    // `createComment` dispara o sweep do outbox fire-and-forget depois do
    // commit. Esperar o recibo observável evita que o teste confunda a janela
    // assíncrona normal com ausência de destinatário.
    await waitForNotificationCount(publisher, subjectId, 1);
    expect(await notificationsFor(actor, subjectId)).toHaveLength(0);
  });

  it("resposta entrega ao autor do pai e ao publicador, mas não ao ator", async () => {
    const publisher = await insertUser("reply-publisher");
    const parentAuthor = await insertUser("reply-parent-author");
    const actor = await insertUser("reply-actor");
    const subjectId = randomUUID();
    const parentId = await create(commentInput(parentAuthor, publisher, subjectId));

    await create(commentInput(actor, publisher, subjectId, parentId));

    await waitForNotificationCount(parentAuthor, subjectId, 1);
    await waitForNotificationCount(publisher, subjectId, 2);
    expect(await notificationsFor(actor, subjectId)).toHaveLength(0);
  });

  it("deduplica publicador que também é autor do pai", async () => {
    const publisherAndParentAuthor = await insertUser("dedup-owner");
    const actor = await insertUser("dedup-actor");
    const subjectId = randomUUID();
    const parentId = await create(
      commentInput(publisherAndParentAuthor, publisherAndParentAuthor, subjectId),
    );

    await create(
      commentInput(actor, publisherAndParentAuthor, subjectId, parentId),
    );

    // Na criação do pai, esta conta também é o ator e portanto recebe zero.
    // Na resposta, ocupa os dois papéis elegíveis (publicador + autor do pai),
    // mas o fan-out deve persistir um único recibo para o evento.
    await waitForNotificationCount(publisherAndParentAuthor, subjectId, 1);
    const items = await notificationsFor(publisherAndParentAuthor, subjectId);
    expect(items).toHaveLength(1);
    expect(items.filter((item) => item.event_type === "comment.replied")).toHaveLength(1);
  });

  it("não entrega à conta removida do autor do pai", async () => {
    const publisher = await insertUser("removed-publisher");
    const parentAuthor = await insertUser("removed-parent-author");
    const actor = await insertUser("removed-actor");
    const subjectId = randomUUID();
    const parentId = await create(commentInput(parentAuthor, publisher, subjectId));

    // O schema define `community_actor_account_link.user_id ON DELETE CASCADE`.
    // O comentário e o ator opaco sobrevivem; sem conta viva,
    // `resolveUserIdOfActor` devolve null e não inventa destinatário.
    await db!.deleteFrom("users").where("id", "=", parentAuthor).execute();

    await create(commentInput(actor, publisher, subjectId, parentId));

    await waitForNotificationCount(publisher, subjectId, 2);
    const replyEventsForPublisher = (await notificationsFor(publisher, subjectId)).filter(
      (item) => item.event_type === "comment.replied",
    );
    expect(replyEventsForPublisher).toHaveLength(1);

    const removedAccountReceipts = await db!
      .selectFrom("notification_receipt")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("recipient_user_id", "=", parentAuthor)
      .executeTakeFirstOrThrow();
    expect(Number(removedAccountReceipts.count)).toBe(0);
  });
});
