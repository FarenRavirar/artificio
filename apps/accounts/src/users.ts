import { sql, type Kysely, type Transaction } from "kysely";
import type { User } from "@artificio/auth";
import type { Database } from "./db.js";
import { BOOTSTRAP_ACTOR_ID } from "./globalRoles.js";

export interface GoogleUserProfile {
  avatar: string | null;
  email: string;
  googleSub: string;
  name: string;
}

function toUser(row: {
  avatar: string | null;
  email: string;
  id: string;
  name: string;
  role: "user" | "moderator" | "admin";
  role_version: number;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    roleVersion: row.role_version,
    avatar: row.avatar,
  };
}

// Spec 083 (downloads: rejeicao com e-mail) — resolucao server-to-server de
// e-mail/nome por user_id. Downloads nao tem tabela users propria (SSO puro),
// entao precisa consultar accounts. sob demanda (nunca cacheia — e-mail pode
// mudar na conta Google, cache ficaria stale sem invalidacao).
export async function findUserById(
  db: Kysely<Database>,
  id: string,
): Promise<{ id: string; email: string; name: string } | null> {
  const row = await db
    .selectFrom("users")
    .select(["id", "email", "name"])
    .where("id", "=", id)
    .executeTakeFirst();

  return row ?? null;
}

export async function findAuthUserById(
  db: Kysely<Database>,
  id: string,
): Promise<User | null> {
  const row = await db
    .selectFrom("users")
    .select(["id", "email", "name", "avatar", "role", "role_version"])
    .where("id", "=", id)
    .executeTakeFirst();

  return row ? toUser(row) : null;
}

export async function upsertGoogleUser(
  db: Kysely<Database>,
  profile: GoogleUserProfile,
  bootstrapAdminEmail?: string,
): Promise<User> {
  const isBootstrapAdmin =
    bootstrapAdminEmail?.trim().toLowerCase() === profile.email.trim().toLowerCase();

  const writeUser = async (executor: Kysely<Database> | Transaction<Database>) => {
    const row = await executor
    .insertInto("users")
    .values({
      google_sub: profile.googleSub,
      email: profile.email,
      name: profile.name,
      avatar: profile.avatar,
      role: "user",
    })
    .onConflict((oc) =>
      oc.column("google_sub").doUpdateSet({
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
      }),
    )
    .returning(["id", "email", "name", "avatar", "role", "role_version"])
    .executeTakeFirstOrThrow();

    return toUser(row);
  };

  if (!isBootstrapAdmin) return writeUser(db);

  return db.transaction().execute(async (trx) => {
    await sql`select
      set_config('app.actor_id', ${BOOTSTRAP_ACTOR_ID}, true),
      set_config('app.role_reason', 'bootstrap_admin', true)
    `.execute(trx);
    const user = await writeUser(trx);
    if (user.role === "admin") return user;

    const promoted = await trx
      .updateTable("users")
      .set({ role: "admin" })
      .where("id", "=", user.id)
      .where("role", "!=", "admin")
      .returning(["id", "email", "name", "avatar", "role", "role_version"])
      .executeTakeFirstOrThrow();

    return toUser(promoted);
  });
}
