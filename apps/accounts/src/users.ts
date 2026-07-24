import type { Kysely } from "kysely";
import type { User } from "@artificio/auth";
import type { Database } from "./db.js";

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
  role: "user" | "admin";
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
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

export async function upsertGoogleUser(
  db: Kysely<Database>,
  profile: GoogleUserProfile,
): Promise<User> {
  const row = await db
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
    .returning(["id", "email", "name", "avatar", "role"])
    .executeTakeFirstOrThrow();

  return toUser(row);
}
