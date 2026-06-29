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

export async function updateUserAvatar(
  db: Kysely<Database>,
  userId: string,
  avatar: string,
): Promise<User> {
  const row = await db
    .updateTable("users")
    .set({ avatar })
    .where("id", "=", userId)
    .returning(["id", "email", "name", "avatar", "role"])
    .executeTakeFirstOrThrow();

  return toUser(row);
}

export async function deleteUser(db: Kysely<Database>, userId: string): Promise<boolean> {
  const result = await db
    .deleteFrom("users")
    .where("id", "=", userId)
    .executeTakeFirst();

  return Number(result.numDeletedRows) > 0;
}
