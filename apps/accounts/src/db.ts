import { Kysely, PostgresDialect, type Generated } from "kysely";
import { Pool } from "pg";

export interface UserRow {
  id: Generated<string>;
  google_sub: string;
  email: string;
  name: string;
  avatar: string | null;
  role: "user" | "moderator" | "admin";
  role_version: Generated<number>;
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

