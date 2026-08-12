import { describe, expect, it, vi, type Mock } from "vitest";

import { processOutboxEntry } from "./notificationOutbox.js";

/**
 * T3.15 — Fan-out do outbox.
 * Testa idempotência com mock de DB.
 * Preferências e moderação são testadas em notificationPreference.test.ts.
 */

interface FakeRecipient {
  recipient_user_id: string;
}

interface DbMock {
  selectFrom: Mock;
  insertInto: Mock;
  updateTable: Mock;
  inserted: FakeRecipient[];
}

function makeDb(existingReceipts: string[]): DbMock {
  const inserted: FakeRecipient[] = [];

  const selectFrom = vi.fn().mockImplementation((_table: string) => {
    return {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(
        _table === "notification_event"
          ? { event_type: "comment.replied" }
          : null,
      ),
      execute: vi.fn().mockResolvedValue(
        existingReceipts.map((uid) => ({ recipient_user_id: uid })),
      ),
    };
  });

  return {
    selectFrom,
    insertInto: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((v: FakeRecipient) => {
        if (existingReceipts.includes(v.recipient_user_id)) {
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        }
        inserted.push(v);
        return { execute: vi.fn().mockResolvedValue(undefined) };
      }),
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    inserted,
  };
}

describe("processOutboxEntry (T3.15)", () => {
  it("não quebra com DB vazio (sem evento, sem recipients)", async () => {
    const db = makeDb([]);
    db.selectFrom.mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      execute: vi.fn().mockResolvedValue([]),
    }));

    const count = await processOutboxEntry(db as never, {
      id: "out-1",
      realm: "prod",
      source_app: "downloads",
      event_id: "evt-1",
    });
    expect(count).toBe(0);
    expect(db.inserted).toHaveLength(0);
  });

  it("não duplica recibo já existente (idempotência)", async () => {
    const db = makeDb(["user-1"]);
    const count = await processOutboxEntry(db as never, {
      id: "out-1",
      realm: "prod",
      source_app: "downloads",
      event_id: "evt-1",
    });
    expect(count).toBe(0);
    expect(db.inserted).toHaveLength(0);
  });
});
