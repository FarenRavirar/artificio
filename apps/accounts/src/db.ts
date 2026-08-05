import { Kysely, PostgresDialect, type Generated } from "kysely";
import { Pool } from "pg";

export interface UserRow {
  id: Generated<string>;
  google_sub: string;
  email: string;
  name: string;
  avatar: string | null;
  /**
   * Existe no banco desde 2026-06-29 (`c051971`), quando o avatar podia ser
   * trocado pelo usuário e esta coluna impedia o login do Google de sobrescrever
   * a imagem escolhida. O restore `a7d9d20`, 5h depois, reverteu `users.ts` a um
   * ponto anterior e levou junto a rota de upload e a proteção — mas a coluna já
   * estava em produção e ficou. Declarada aqui e em `migration_004` para que o
   * tipo e a esteira parem de divergir do banco real (achado de 2026-07-31).
   *
   * A feature foi restaurada junto (2026-07-31): `updateUserAvatar` grava
   * `'custom'` e o `CASE` em `upsertGoogleUser` lê esse valor para não deixar o
   * login com Google sobrescrever a foto escolhida. **As duas escritas são a
   * mesma decisão** — remover uma sem a outra faz a coluna virar decoração e o
   * avatar custom sumir no login seguinte, sem erro nenhum.
   */
  avatar_source: Generated<"google" | "custom">;
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

/**
 * T2.2a — credencial de serviço por `source_app` e `realm`
 * (`migration_007_service_credentials.sql`).
 *
 * `realm` e `source_app` das rotas internas são **derivados desta linha**, nunca
 * lidos do payload — é o que `spec.md` §"Trust boundary e credenciais" exige e o
 * que o `SERVICE_SECRET` único e global não conseguia expressar.
 */
export interface CommunityServiceCredentialRow {
  id: Generated<string>;
  /** Prefixo público do header `<token_id>.<segredo>`. Não é secreto. */
  token_id: string;
  /** Argon2id do segredo. Nunca o segredo em claro. */
  token_hash: string;
  source_app: string;
  /** Sempre exatamente um elemento (CHECK `..._single_realm` na migration). */
  realms: string[];
  scopes: string[];
  /**
   * Papel na janela de rotação `current` + `next` (`spec.md` §"Trust boundary e
   * credenciais"). As duas coexistem ativas durante a troca; sem isso a rotação
   * exigiria downtime, e segredo que só rotaciona com downtime não rotaciona.
   */
  rotation_slot: Generated<"current" | "next">;
  description: Generated<string>;
  created_at: Generated<Date>;
  created_by: string | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  last_used_at: Date | null;
}

export interface Database {
  users: UserRow;
  admin_secrets: AdminSecretRow;
  community_service_credential: CommunityServiceCredentialRow;
}

export function createDb(databaseUrl: string) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });
}

