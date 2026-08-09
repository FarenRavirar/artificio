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
 * Declaram as colunas que a leitura consome **mais as chaves estruturais** da
 * tabela (`canonical_path`, `owner_user_id`, `current_version_id`, `legacy_id`),
 * que as tasks seguintes do Bloco B usam para escrita e versionamento.
 *
 * O que fica deliberadamente **de fora** é o dado que `contrato-http-v1.md` §2
 * proíbe no payload público: identidade de votante, motivo de remoção, nota
 * interna de moderação, fingerprint. Cada uma dessas colunas ausente aqui é uma
 * que o `SELECT` não consegue pedir por engano — o compilador barra o
 * vazamento antes do teste.
 *
 * (A redação anterior dizia "só as colunas que a leitura usa", o que não batia
 * com as interfaces declaradas — achado de review, PR #245.)
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
  /**
   * Tombstone (T2.7). As três colunas existem em `migration_006:158-160` desde
   * o início e faltavam aqui — o tipo descrevia uma tabela sem retirada, então
   * qualquer `UPDATE` de remoção era erro de compilação e não de banco.
   *
   * `community_comment_removal_check` amarra as quatro: `visible` e
   * `pending_review_hidden` exigem as três nulas; os dois estados removidos
   * exigem as três preenchidas, com `removed_reason` não-vazio. Não há tombstone
   * sem motivo registrado, nem em auto-retirada — por isso o `DELETE` do autor
   * grava um motivo canônico em vez de `null`.
   */
  removed_at: Date | null;
  removed_by_actor_id: string | null;
  removed_reason: string | null;
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

/**
 * Trilha append-only de mudança de voto (T2.12; decisões 11, 12, 14).
 *
 * `community_comment_vote_audit_immutable` recusa `UPDATE` e `DELETE` — medido em
 * `pg_trigger` de produção. `old_value`/`new_value` guardam a transição, e
 * `community_comment_vote_audit_change_check` recusa linha que não muda nada:
 * no-op não vira histórico (`contrato-http-v1.md` §7).
 *
 * `reason` distingue voto do usuário (`user_vote`) de invalidação por abuso
 * (T2.26), que preenche `invalidated_by_actor_id`.
 */
export interface CommunityCommentVoteAuditRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  community_actor_id: string;
  comment_id: string;
  /** `null` quando o ator não tinha voto antes. */
  old_value: -1 | 1 | null;
  /** `null` quando o voto foi removido (`value: 0` no contrato). */
  new_value: -1 | 1 | null;
  reason: Generated<string>;
  invalidated_by_actor_id: string | null;
  occurred_at: Generated<Date>;
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

/**
 * Versão imutável do corpo. Editar cria linha nova e move
 * `community_comment.current_version_id` — o histórico nunca é reescrito
 * (`spec.md` 17), e é ele que a denúncia fixa como evidência (12d).
 */
export interface CommunityCommentVersionRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  comment_id: string;
  authored_by_actor_id: string | null;
  body_markdown: string | null;
  legacy_content_html: string | null;
  created_at: Generated<Date>;
  redacted_at: Date | null;
  redacted_by_actor_id: string | null;
  redaction_reason: string | null;
}

/**
 * Trilha append-only de ação de moderação e de ciclo de vida (T2.7).
 *
 * `community_moderation_audit_immutable` recusa `UPDATE` e `DELETE` — medido em
 * produção (`pg_trigger` de `artificio_auth`, 2026-08-09). Escrever aqui é
 * definitivo, e é isso que a torna evidência.
 *
 * `actor_id` é quem executou; `target_id` é o alvo (aqui, o comentário).
 * `reason` é `NOT NULL` com `LENGTH(BTRIM(reason)) > 0` no schema, então nenhuma
 * ação entra sem motivo legível.
 */
export interface CommunityModerationAuditRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  metadata: Generated<unknown>;
  occurred_at: Generated<Date>;
}

/**
 * Ocorrência imutável. `snapshot` guarda os dados de apresentação **versionados**
 * (`spec.md` 13b): título editado depois não pode mudar o sentido de uma
 * notificação histórica. O texto é montado na leitura, nunca gravado aqui.
 */
export interface NotificationEventRow {
  id: Generated<string>;
  /** Idempotência de produtor externo (`spec.md` 13c); nesta fase, gerado aqui. */
  event_id: string;
  realm: string;
  source_app: string;
  event_type: string;
  event_version: number;
  subject_type: string;
  subject_id: string;
  actor_id: string | null;
  canonical_path: string;
  snapshot: unknown;
  occurred_at: Generated<Date>;
  created_at: Generated<Date>;
}

/**
 * Estado por destinatário. Unicidade
 * `(realm, source_app, event_id, recipient_user_id)` é a segunda barreira da
 * dedupe de 15c — a primeira é `resolveNotificationRecipients`.
 */
export interface NotificationReceiptRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  event_id: string;
  recipient_user_id: string;
  read_at: Date | null;
  created_at: Generated<Date>;
}

/**
 * Registro de `Idempotency-Key` (`contrato-http-v1.md` §6, migration 008).
 * Retenção 24h; `request_hash` distingue repetição idêntica (devolve a resposta
 * original) de reuso com payload diferente (`409`).
 */
export interface CommunityIdempotencyKeyRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  idempotency_key: string;
  operation: string;
  acting_user_id: string | null;
  request_hash: string;
  response_status: number;
  response_body: unknown;
  created_at: Generated<Date>;
  expires_at: Date;
}

/**
 * Sanção por ator. Ativa = `starts_at` no passado, sem `lifted_at`, e sem
 * `expires_at` ou com ele no futuro. Levantada ou vencida permanece na tabela:
 * é o histórico que sustenta auditoria (`spec.md` 12f).
 */
export interface CommunityRestrictionRow {
  id: Generated<string>;
  realm: string;
  source_app: string;
  actor_id: string;
  scope: string;
  level: string;
  reason: string;
  imposed_by_actor_id: string;
  starts_at: Generated<Date>;
  expires_at: Date | null;
  lifted_at: Date | null;
  lifted_by_actor_id: string | null;
  lift_reason: string | null;
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
  community_comment_version: CommunityCommentVersionRow;
  community_comment_vote: CommunityCommentVoteRow;
  community_comment_vote_audit: CommunityCommentVoteAuditRow;
  community_idempotency_key: CommunityIdempotencyKeyRow;
  community_moderation_audit: CommunityModerationAuditRow;
  community_restriction: CommunityRestrictionRow;
  notification_event: NotificationEventRow;
  notification_receipt: NotificationReceiptRow;
}

export function createDb(databaseUrl: string) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });
}

