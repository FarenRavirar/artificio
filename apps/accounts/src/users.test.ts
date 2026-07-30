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

import { upsertGoogleUser } from "./users.js";

function fakeDb() {
  const order: string[] = [];
  const doUpdateSet = vi.fn();
  const values = vi.fn().mockReturnThis();
  const updateSet = vi.fn().mockReturnThis();
  const update = {
    set: updateSet,
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn(async () => {
      order.push("update");
      return {
        id: "account-1",
        email: "admin@example.com",
        name: "Admin",
        avatar: null,
        role: "admin",
        role_version: 2,
      };
    }),
  };
  const insert = {
    values,
    onConflict: vi.fn((callback: (oc: unknown) => unknown) => {
      callback({ column: vi.fn(() => ({ doUpdateSet })) });
      return insert;
    }),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn(async () => {
      order.push("insert");
      return {
        id: "account-1",
        email: "admin@example.com",
        name: "Admin",
        avatar: null,
        role: "user",
        role_version: 1,
      };
    }),
  };
  const trx = {
    insertInto: vi.fn(() => insert),
    updateTable: vi.fn(() => update),
  };
  const transaction = vi.fn(() => ({
    execute: (callback: (value: unknown) => unknown) => callback(trx),
  }));
  sqlExecute.mockImplementation(async () => {
    order.push("actor");
  });
  return {
    db: { transaction, insertInto: trx.insertInto } as never,
    doUpdateSet,
    order,
    transaction,
    updateSet,
    values,
  };
}

const profile = {
  avatar: null,
  email: "admin@example.com",
  googleSub: "google-1",
  name: "Admin",
};

describe("upsertGoogleUser bootstrap", () => {
  beforeEach(() => sqlExecute.mockReset());

  it("promove no primeiro login e configura ator antes da escrita", async () => {
    const fake = fakeDb();

    const user = await upsertGoogleUser(fake.db, profile, " ADMIN@EXAMPLE.COM ");

    expect(fake.order).toEqual(["actor", "insert", "update"]);
    expect(fake.values).toHaveBeenCalledWith(expect.objectContaining({ role: "user" }));
    expect(fake.doUpdateSet).not.toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
    expect(fake.updateSet).toHaveBeenCalledWith({ role: "admin" });
    expect(user).toMatchObject({ role: "admin", roleVersion: 2 });
  });

  it("mantém login comum fora da transação de bootstrap", async () => {
    const fake = fakeDb();

    await upsertGoogleUser(fake.db, { ...profile, email: "user@example.com" }, "admin@example.com");

    expect(fake.transaction).not.toHaveBeenCalled();
    expect(sqlExecute).not.toHaveBeenCalled();
    expect(fake.values).toHaveBeenCalledWith(expect.objectContaining({ role: "user" }));
    expect(fake.updateSet).not.toHaveBeenCalled();
  });
});
