import type { UserRole } from "@artificio/auth";
import { sql, type Kysely } from "kysely";
import type { Database } from "./db.js";

export const BOOTSTRAP_ACTOR_ID = "bootstrap:accounts";

export async function ensureBootstrapAdmin(
  db: Kysely<Database>,
  configuredEmail: string | undefined,
): Promise<"disabled" | "admin_ready" | "promoted" | "missing_account"> {
  const email = configuredEmail?.trim().toLowerCase();
  if (!email) return "disabled";

  return db.transaction().execute(async (trx) => {
    await sql`select
      set_config('app.actor_id', ${BOOTSTRAP_ACTOR_ID}, true),
      set_config('app.role_reason', 'bootstrap_admin', true)
    `.execute(trx);

    const updated = await trx
      .updateTable("users")
      .set({ role: "admin" })
      .where(sql<string>`lower(email)`, "=", email)
      .where("role", "!=", "admin")
      .returning("id")
      .executeTakeFirst();

    if (updated) return "promoted";

    const existing = await trx
      .selectFrom("users")
      .select("role")
      .where(sql<string>`lower(email)`, "=", email)
      .executeTakeFirst();

    return existing?.role === "admin" ? "admin_ready" : "missing_account";
  });
}

export interface GlobalRoleUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleVersion: number;
  createdAt: Date;
}

export async function listGlobalRoleUsers(
  db: Kysely<Database>,
  search: string,
): Promise<GlobalRoleUser[]> {
  let query = db
    .selectFrom("users")
    .select(["id", "email", "name", "role", "role_version", "created_at"])
    .orderBy("created_at", "desc")
    .limit(200);

  const normalized = search.trim();
  if (normalized) {
    const pattern = `%${normalized}%`;
    query = query.where((eb) => eb.or([
      eb("email", "ilike", pattern),
      eb("name", "ilike", pattern),
    ]));
  }

  const rows = await query.execute();
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    roleVersion: row.role_version,
    createdAt: row.created_at,
  }));
}

export async function setGlobalRole(
  db: Kysely<Database>,
  actorId: string,
  actorRoleVersion: number,
  userId: string,
  role: UserRole,
): Promise<GlobalRoleUser | null> {
  if (actorId === userId && role !== "admin") {
    throw new Error("SELF_DEMOTION_FORBIDDEN");
  }

  return db.transaction().execute(async (trx) => {
    // O guard de rota já revalidou o ator no banco, mas fora desta transação:
    // entre aquela consulta e este UPDATE, outro admin pode ter rebaixado o
    // ator — e a requisição já autorizada seguiria, permitindo inclusive que
    // ele recuperasse o próprio privilégio (achado de review, PR #233).
    // `FOR UPDATE` trava a linha do ator até o commit, então um rebaixamento
    // concorrente espera e a revalidação abaixo enxerga o estado final.
    const actor = await trx
      .selectFrom("users")
      .select(["role", "role_version"])
      .where("id", "=", actorId)
      .forUpdate()
      .executeTakeFirst();

    if (actor?.role !== "admin" || actor.role_version !== actorRoleVersion) {
      throw new Error("ACTOR_NO_LONGER_ADMIN");
    }

    await sql`select
      set_config('app.actor_id', ${actorId}, true),
      set_config('app.role_reason', 'admin_panel', true)
    `.execute(trx);

    const row = await trx
      .updateTable("users")
      .set({ role })
      .where("id", "=", userId)
      .returning(["id", "email", "name", "role", "role_version", "created_at"])
      .executeTakeFirst();

    return row ? {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      roleVersion: row.role_version,
      createdAt: row.created_at,
    } : null;
  });
}
