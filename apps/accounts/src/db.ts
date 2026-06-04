import { Kysely, PostgresDialect, sql, type Generated } from "kysely";
import { Pool } from "pg";

export interface UserRow {
  id: Generated<string>;
  google_sub: string;
  email: string;
  name: string;
  avatar: string | null;
  role: "user" | "admin";
  created_at: Generated<Date>;
}

export interface Database {
  users: UserRow;
}

export function createDb(databaseUrl: string) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });
}

export async function migrate(db: Kysely<Database>) {
  await sql`create extension if not exists "uuid-ossp"`.execute(db);
  await sql`
    create table if not exists users (
      id uuid primary key default uuid_generate_v4(),
      google_sub text unique not null,
      email text not null,
      name text not null,
      avatar text,
      role text not null default 'user',
      created_at timestamptz not null default now()
    )
  `.execute(db);
}
