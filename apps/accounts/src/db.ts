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

export interface AdminSecretRow {
  id: Generated<string>;
  name: string;
  ciphertext: string;
  updated_by: string | null;
  updated_at: Generated<Date>;
}

export interface Database {
  users: UserRow;
  admin_secrets: AdminSecretRow;
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

  // WS3: segredos de admin cifrados (DeepSeek key, etc.)
  await sql`
    create table if not exists admin_secrets (
      id uuid primary key default uuid_generate_v4(),
      name text unique not null,
      ciphertext text not null,
      updated_by text,
      updated_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`
    create index if not exists idx_admin_secrets_name
    on admin_secrets (name)
  `.execute(db);
}
