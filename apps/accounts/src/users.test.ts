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

import { updateUserAvatar, upsertGoogleUser } from "./users.js";

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
    db: { transaction, insertInto: trx.insertInto, updateTable: trx.updateTable } as never,
    doUpdateSet,
    order,
    transaction,
    updateSet,
    values,
  };
}

/**
 * Executa o `CASE` que o upsert monta, contra um `avatar_source` de escolha do
 * teste. `doUpdateSet` recebe um objeto cujo campo `avatar` é uma função que o
 * Kysely chamaria com seu expression builder; aqui o builder é falso e só
 * registra qual ramo foi escolhido, que é o que importa provar.
 */
function resolveAvatarBranch(
  doUpdateSet: ReturnType<typeof vi.fn>,
  storedSource: "google" | "custom",
): unknown {
  const patch = doUpdateSet.mock.calls[0]?.[0] as { avatar?: unknown };
  if (typeof patch?.avatar !== "function") return patch?.avatar;

  let whenSource: string | undefined;
  let whenValue: unknown;
  let elseValue: unknown;
  const chain = {
    when: (column: string, _operator: string, value: unknown) => {
      whenSource = `${column}:${String(value)}`;
      return chain;
    },
    then: (value: unknown) => {
      whenValue = value;
      return chain;
    },
    else: (value: unknown) => {
      elseValue = value;
      return chain;
    },
    end: () =>
      whenSource === `users.avatar_source:custom` && storedSource === "custom"
        ? whenValue
        : elseValue,
  };

  return (patch.avatar as (eb: unknown) => unknown)({
    case: () => chain,
    ref: (column: string) => `REF(${column})`,
  });
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

/**
 * A proteção do avatar personalizado, restaurada em 2026-07-31: existia até
 * `a7d9d20` (2026-06-29) e foi perdida num restore que reverteu `users.ts` a um
 * ponto anterior — a coluna `avatar_source` seguiu em produção sem ninguém que
 * a lesse ou escrevesse. Sem estes testes, a regressão volta calada: nada quebra,
 * o avatar apenas some no login seguinte.
 */
describe("avatar personalizado sobrevive ao login com Google", () => {
  beforeEach(() => sqlExecute.mockReset());

  it("preserva o avatar do banco quando a origem é 'custom'", async () => {
    const fake = fakeDb();

    await upsertGoogleUser(fake.db, { ...profile, avatar: "https://google/foto.jpg" });

    // Ramo `custom`: mantém o que está no banco, ignorando a foto do Google.
    expect(resolveAvatarBranch(fake.doUpdateSet, "custom")).toBe("REF(users.avatar)");
  });

  it("usa o avatar do Google quando a origem é 'google'", async () => {
    const fake = fakeDb();

    await upsertGoogleUser(fake.db, { ...profile, avatar: "https://google/foto.jpg" });

    // Sem foto escolhida pelo usuário, o login segue atualizando normalmente.
    expect(resolveAvatarBranch(fake.doUpdateSet, "google")).toBe("https://google/foto.jpg");
  });

  it("marca a origem como 'custom' ao trocar a foto", async () => {
    const fake = fakeDb();

    await updateUserAvatar(fake.db, "account-1", "https://cdn/nova.png");

    // As duas escritas são a mesma decisão: sem a marcação, o CASE acima não tem
    // o que checar e a proteção nunca dispara.
    expect(fake.updateSet).toHaveBeenCalledWith({
      avatar: "https://cdn/nova.png",
      avatar_source: "custom",
    });
  });
});
