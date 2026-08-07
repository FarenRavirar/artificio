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

/**
 * T2.3 — tabelas que a leitura em árvore consulta
 * (`migration_006_community_comments.sql`).
 *
 * Só as colunas que a leitura usa são declaradas. Cada coluna a mais aqui é uma
 * que o `SELECT` pode acidentalmente pedir, e as tabelas comunitárias guardam
 * dado que `contrato-http-v1.md` §2 proíbe no payload público (identidade de
 * votante, motivo de remoção, nota de moderação). Declarar o mínimo faz o
 * compilador barrar o vazamento antes do teste.
 */
export interface CommunityCommentSubjectRow {
  realm: string;
  source_app: string;
  subject_type: string;
  subject_id: string;
  canonical_path: string;
  owner_user_id: string | null;
  /** `spec.md` 8d — revisão que a leitura congela como `snapshot_revision`. */
  ranking_revision: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CommunityCommentRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  subject_type: string;
  subject_id: string;
  community_actor_id: string | null;
  parent_id: string | null;
  root_id: string;
  depth: number;
  body_markdown: string | null;
  legacy_content_html: string | null;
  current_version_id: string;
  created_revision: number;
  visibility_state: Generated<
    "visible" | "author_removed" | "moderator_removed" | "pending_review_hidden"
  >;
  edited_at: Date | null;
  legacy_source: string | null;
  legacy_id: string | null;
  legacy_author_name: string | null;
  created_at: Generated<Date>;
}

/**
 * Faixa de score válida por revisão. `valid_to_revision IS NULL` é a faixa
 * corrente; a leitura de uma revisão congelada procura a faixa que **contém**
 * aquela revisão, não a corrente — é o que mantém a posição estável enquanto
 * votos novos chegam (`spec.md` 8d).
 */
export interface CommunityCommentScoreVersionRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  comment_id: string;
  valid_from_revision: number;
  valid_to_revision: number | null;
  upvotes: number;
  downvotes: number;
  /** Coluna gerada: `upvotes - downvotes`. */
  score: Generated<number>;
  /** Coluna gerada por `comment_wilson_reddit_80_v1`; `numeric` chega string. */
  best_score: Generated<string>;
  algorithm_version: Generated<string>;
  created_at: Generated<Date>;
}

export interface CommunityCommentVoteRow {
  realm: string;
  source_app: string;
  community_actor_id: string;
  comment_id: string;
  value: -1 | 1;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

/** Ator opaco. O vínculo com a conta vive na tabela de link, não aqui. */
export interface CommunityActorRow {
  id: Generated<string>;
  created_at: Generated<Date>;
}

export interface CommunityActorAccountLinkRow {
  actor_id: string;
  user_id: string;
  retention_until: Date | null;
  legal_hold: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Database {
  users: UserRow;
  admin_secrets: AdminSecretRow;
  community_service_credential: CommunityServiceCredentialRow;
  community_actor: CommunityActorRow;
  community_actor_account_link: CommunityActorAccountLinkRow;
  community_comment: CommunityCommentRow;
  community_comment_score_version: CommunityCommentScoreVersionRow;
  community_comment_subject: CommunityCommentSubjectRow;
  community_comment_vote: CommunityCommentVoteRow;
}

export function createDb(databaseUrl: string) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });
}

