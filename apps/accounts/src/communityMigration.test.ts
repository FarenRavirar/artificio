import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migration_006_community_comments.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");

// O nome precisa terminar num delimitador: `indexOf` cru casava por prefixo, e
// procurar `community_comment` encontraria `community_comment_vote_audit` se ela
// viesse antes no arquivo. Hoje passaria só pela ordem das declarações.
function tableDefinition(table: string): string {
  const declaration = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${table}(?![0-9A-Za-z_])`,
  );
  const start = migration.search(declaration);
  expect(start, `tabela ${table} não declarada na migration`).toBeGreaterThanOrEqual(0);
  const nextTable = migration.indexOf("CREATE TABLE IF NOT EXISTS ", start + 1);
  return migration.slice(start, nextTable === -1 ? undefined : nextTable);
}

describe("migration_006_community_comments", () => {
  it("mantem o header executavel exigido pelo runner", () => {
    expect(migration.split(/\r?\n/).slice(0, 5)).toEqual([
      "-- @class: online-safe",
      "-- @requires-backup: false",
      "-- @author: spec-090",
      "-- @created: 2026-08-04",
      "-- @description: Schema comunitario de comentarios, votos, notificacoes e moderacao",
    ]);
  });

  it("cria o nucleo transacional inteiro em uma migration", () => {
    const requiredTables = [
      "community_actor",
      "community_actor_account_link",
      "community_comment_subject",
      "community_comment",
      "community_comment_version",
      "community_comment_vote",
      "community_comment_vote_audit",
      "community_comment_score_version",
      "notification_event",
      "notification_receipt",
      "community_comment_report",
      "community_moderation_case",
      "community_comment_version_approval",
      "community_comment_appeal",
      "community_restriction",
      "community_moderation_audit",
    ];

    for (const table of requiredTables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("delega score e Wilson ao PostgreSQL", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION comment_wilson_reddit_80_v1",
    );
    expect(migration).toMatch(
      /score INTEGER GENERATED ALWAYS AS \(upvotes - downvotes\) STORED/,
    );
    // Preguiçoso e sem `;`: o `[\s\S]*` guloso anterior podia atravessar o fim do
    // CREATE TABLE e casar com uma ocorrência de statement posterior, dando verde
    // mesmo se a expressão de `best_score` estivesse errada.
    expect(migration).toMatch(
      /best_score NUMERIC GENERATED ALWAYS AS \([^;]*?comment_wilson_reddit_80_v1\(upvotes, downvotes\)[^;]*?\) STORED/,
    );
  });

  it("mantem IP fora do dominio comunitario", () => {
    // `i` obrigatório: sem ele o invariante ignorava `inet`/`cidr` minúsculos,
    // que é como o tipo de fato seria escrito numa coluna nova.
    expect(migration).not.toMatch(
      /\b(?:client_ip|ip_address|remote_addr|forwarded_for|INET|CIDR)\b/i,
    );
  });

  it("materializa limites estruturais e unicidades de abuso", () => {
    expect(migration).toContain("root_id UUID NOT NULL");
    expect(migration).toContain("depth SMALLINT NOT NULL CHECK (depth BETWEEN 0 AND 4)");
    expect(migration).toContain("uq_community_comment_report_active");
    expect(migration).toContain("uq_community_moderation_case_open");
    expect(migration).toContain("uq_community_restriction_active");
    expect(migration).toContain(
      "ON community_comment(legacy_source, legacy_id)",
    );
  });

  it("repete realm e source_app em toda linha vinculada a assunto", () => {
    const scopedTables = [
      "community_comment_subject",
      "community_comment",
      "community_comment_version",
      "community_comment_vote",
      "community_comment_vote_audit",
      "community_comment_score_version",
      "notification_event",
      "notification_receipt",
      "community_moderation_case",
      "community_comment_report",
      "community_comment_version_approval",
      "community_comment_appeal",
      "community_restriction",
      "community_moderation_audit",
    ];

    for (const table of scopedTables) {
      const definition = tableDefinition(table);
      expect(definition).toContain("realm TEXT NOT NULL");
      expect(definition).toContain("source_app TEXT NOT NULL");
    }
  });

  it("exige auditoria atomica para estados terminais", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION require_community_terminal_audit()",
    );
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(migration).toContain("report.' || NEW.state");
    expect(migration).toContain("appeal.' || NEW.status");
  });

  // Achados da review da PR #241, reproduzidos em Postgres real antes de corrigir.
  it("prende a auditoria terminal a transacao corrente", () => {
    // Sem isto, auditoria commitada numa transação anterior servia de álibi para
    // uma transição posterior — a garantia "na mesma transação" não existia.
    expect(migration).toContain("audit.xmin = pg_current_xact_id()::xid");
  });

  it("cobre INSERT direto em estado terminal, nao so UPDATE", () => {
    // INSERT de caso já `closed` / denúncia já resolvida / recurso já decidido
    // entrava sem auditoria nenhuma enquanto o trigger só olhava UPDATE.
    const guard = migration.slice(
      migration.indexOf("FUNCTION require_community_terminal_audit()"),
    );
    for (const table of [
      "community_moderation_case",
      "community_comment_report",
      "community_comment_appeal",
    ]) {
      const branch = guard.slice(guard.indexOf(`TG_TABLE_NAME = '${table}'`));
      expect(
        branch.slice(0, branch.indexOf("ELSIF TG_TABLE_NAME")),
        `ramo de ${table} precisa tratar INSERT`,
      ).toContain("TG_OP = 'INSERT'");
    }
  });

  it("nao usa ON DELETE SET NULL em tabela append-only", () => {
    // SET NULL numa tabela append-only falha com "append-only" no meio da
    // cascata; o expurgo do requisito 7b desfaz o vínculo ator→conta, não o ator.
    for (const table of [
      "community_actor_link_audit",
      "community_comment_vote_audit",
      "community_moderation_audit",
      "notification_event",
    ]) {
      expect(
        tableDefinition(table),
        `${table} é append-only e não pode ter ON DELETE SET NULL`,
      ).not.toContain("ON DELETE SET NULL");
    }
  });

  it("protege a versao do comentario tambem contra DELETE", () => {
    // A versão é a evidência fixada por reported_version_id e decision_version_id;
    // apagar a linha destrói a prova. Expurgo tem caminho próprio (`redacted_at`).
    expect(migration).toContain("community_comment_version_reject_delete");
    expect(migration).toMatch(
      /BEFORE DELETE ON community_comment_version[\s\S]{0,120}?reject_immutable_row_change\(\)/,
    );
  });
});
