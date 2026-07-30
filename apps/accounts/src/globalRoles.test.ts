import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlExecute = vi.hoisted(() => vi.fn());
vi.mock("kysely", async (importOriginal) => {
  const actual = await importOriginal<typeof import("kysely")>();
  return {
    ...actual,
    sql: Object.assign(
      (..._args: unknown[]) => ({ execute: sqlExecute }),
      actual.sql,
    ),
  };
});

import { BOOTSTRAP_ACTOR_ID, ensureBootstrapAdmin, setGlobalRole } from "./globalRoles.js";

function fakeDb(updatedRows: Array<Record<string, unknown> | undefined>) {
  const order: string[] = [];
  const update = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn(async () => {
      order.push("update");
      return updatedRows.shift();
    }),
  };
  const trx = { updateTable: vi.fn(() => update) };
  const transaction = vi.fn(() => ({ execute: (callback: (value: unknown) => unknown) => callback(trx) }));
  sqlExecute.mockImplementation(async () => {
    order.push("actor");
  });
  return { db: { transaction } as never, update, order, transaction };
}

describe("ensureBootstrapAdmin", () => {
  beforeEach(() => sqlExecute.mockReset());

  it("não abre transação quando variável não existe", async () => {
    const fake = fakeDb([]);
    await expect(ensureBootstrapAdmin(fake.db, undefined)).resolves.toBe("disabled");
    expect(fake.transaction).not.toHaveBeenCalled();
  });

  it("promove com ator bootstrap antes do update e é idempotente", async () => {
    const fake = fakeDb([{ id: "admin-1" }, undefined]);

    await expect(ensureBootstrapAdmin(fake.db, " ADMIN@EXAMPLE.COM ")).resolves.toBe("promoted");
    await expect(ensureBootstrapAdmin(fake.db, "admin@example.com")).resolves.toBe("unchanged_or_missing");

    expect(fake.order).toEqual(["actor", "update", "actor", "update"]);
    expect(BOOTSTRAP_ACTOR_ID).toBe("bootstrap:accounts");
    expect(fake.update.set).toHaveBeenCalledWith({ role: "admin" });
  });

  it("sobrevive à conta ainda ausente", async () => {
    const fake = fakeDb([undefined]);
    await expect(ensureBootstrapAdmin(fake.db, "missing@example.com")).resolves.toBe("unchanged_or_missing");
  });
});

describe("setGlobalRole", () => {
  beforeEach(() => sqlExecute.mockReset());

  it("recusa auto-rebaixamento antes de abrir transação", async () => {
    const fake = fakeDb([]);
    await expect(setGlobalRole(fake.db, "admin-1", "admin-1", "moderator"))
      .rejects.toThrow("SELF_DEMOTION_FORBIDDEN");
    expect(fake.transaction).not.toHaveBeenCalled();
  });

  it("configura ator antes de alterar papel", async () => {
    const fake = fakeDb([{
      id: "user-1",
      email: "user@example.com",
      name: "Pessoa",
      role: "moderator",
      role_version: 2,
      created_at: new Date("2026-07-30T00:00:00Z"),
    }]);

    const user = await setGlobalRole(fake.db, "admin-1", "user-1", "moderator");
    expect(fake.order).toEqual(["actor", "update"]);
    expect(user).toMatchObject({ id: "user-1", role: "moderator", roleVersion: 2 });
  });
});
