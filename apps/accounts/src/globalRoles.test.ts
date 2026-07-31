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

function fakeDb(
  updatedRows: Array<Record<string, unknown> | undefined>,
  selectedRows: Array<Record<string, unknown> | undefined> = [],
) {
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
  const select = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    // `setGlobalRole` trava a linha do ator com `FOR UPDATE` para revalidar
    // dentro da transação (achado de review, PR #233).
    forUpdate: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn(async () => selectedRows.shift()),
  };
  const trx = {
    updateTable: vi.fn(() => update),
    selectFrom: vi.fn(() => select),
  };
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
    const fake = fakeDb([{ id: "admin-1" }, undefined], [{ role: "admin" }]);

    await expect(ensureBootstrapAdmin(fake.db, " ADMIN@EXAMPLE.COM ")).resolves.toBe("promoted");
    await expect(ensureBootstrapAdmin(fake.db, "admin@example.com")).resolves.toBe("admin_ready");

    expect(fake.order).toEqual(["actor", "update", "actor", "update"]);
    expect(BOOTSTRAP_ACTOR_ID).toBe("bootstrap:accounts");
    expect(fake.update.set).toHaveBeenCalledWith({ role: "admin" });
  });

  it("sobrevive à conta ainda ausente", async () => {
    const fake = fakeDb([undefined], [undefined]);
    await expect(ensureBootstrapAdmin(fake.db, "missing@example.com")).resolves.toBe("missing_account");
  });
});

describe("setGlobalRole", () => {
  beforeEach(() => sqlExecute.mockReset());

  const ADMIN_ACTOR = { role: "admin", role_version: 5 };

  it.each(["user", "moderator"] as const)("recusa auto-rebaixamento para %s antes de abrir transação", async (role) => {
    const fake = fakeDb([]);
    await expect(setGlobalRole(fake.db, "admin-1", 5, "admin-1", role))
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
    }], [ADMIN_ACTOR]);

    const user = await setGlobalRole(fake.db, "admin-1", 5, "user-1", "moderator");
    expect(fake.order).toEqual(["actor", "update"]);
    expect(user).toMatchObject({ id: "user-1", role: "moderator", roleVersion: 2 });
  });

  // A revalidação dentro da transação é o que impede que um ator rebaixado
  // entre o guard de rota e o UPDATE ainda execute a alteração — inclusive
  // recuperando o próprio privilégio (achado de review, PR #233).
  it("recusa quando o ator deixou de ser admin durante a requisição", async () => {
    const fake = fakeDb([], [{ role: "user", role_version: 6 }]);
    await expect(setGlobalRole(fake.db, "admin-1", 5, "user-1", "admin"))
      .rejects.toThrow("ACTOR_NO_LONGER_ADMIN");
    expect(fake.update.executeTakeFirst).not.toHaveBeenCalled();
  });

  it("recusa quando o roleVersion do ator avançou", async () => {
    const fake = fakeDb([], [{ role: "admin", role_version: 6 }]);
    await expect(setGlobalRole(fake.db, "admin-1", 5, "user-1", "admin"))
      .rejects.toThrow("ACTOR_NO_LONGER_ADMIN");
    expect(fake.update.executeTakeFirst).not.toHaveBeenCalled();
  });
});
