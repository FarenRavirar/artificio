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

/**
 * `recipients`: quem está no outbox pra este evento (JSONB simulado).
 * `existingReceipts`: quem já tem recibo — inserção desses vira ON CONFLICT
 * DO NOTHING (numInsertedOrUpdatedRows = 0n), não erro. A implementação real
 * não usa try/catch pra duplicata (achado CodeRabbit, PR #255: erro de
 * constraint sem savepoint abortaria a transação inteira).
 */
function makeDb(existingReceipts: string[], recipients: string[] = []): DbMock {
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
          : _table === "notification_outbox"
            ? { recipients }
            : null,
      ),
      // Preferências desligadas: nenhuma. O filtro não deve remover ninguém.
      execute: vi.fn().mockResolvedValue([]),
    };
  });

  return {
    selectFrom,
    insertInto: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((v: FakeRecipient) => ({
        onConflict: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockImplementation(() => {
            const isDuplicate = existingReceipts.includes(v.recipient_user_id);
            if (!isDuplicate) inserted.push(v);
            return Promise.resolve({
              numInsertedOrUpdatedRows: isDuplicate ? 0n : 1n,
            });
          }),
        }),
      })),
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
    // `user-1` já tem recibo; `user-2` não. O fan-out precisa alcançar os
    // dois — sem `recipients` no outbox mock, o teste antigo saía antes de
    // chegar no insert e passava mesmo sem exercer o caminho de duplicata
    // (achado CodeRabbit, PR #255).
    const db = makeDb(["user-1"], ["user-1", "user-2"]);
    const count = await processOutboxEntry(db as never, {
      id: "out-1",
      realm: "prod",
      source_app: "downloads",
      event_id: "evt-1",
    });
    expect(count).toBe(1);
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0].recipient_user_id).toBe("user-2");
  });
});
