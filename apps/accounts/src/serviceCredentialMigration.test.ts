import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SERVICE_SCOPES } from "./serviceCredential.js";

const migrationPath = fileURLToPath(
  new URL("../database/migration_007_service_credentials.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");

// T3.13 (spec 090) — `notification.write` entrou pela migration 011, que amplia
// o CHECK declarado aqui. O espelho TypeScript↔SQL abaixo precisa enxergar as
// duas: checar só a 007 faria um escopo novo, legítimo e já aplicado, parecer
// ausente do banco.
const scopeMigrations = [
  migration,
  ...[
    "../database/migration_011_notification_ingest_scope.sql",
    // T7.4b (spec 096): `notification.migrate` entrou pela 012, pelo mesmo
    // mecanismo — sem ela aqui, o escopo novo pareceria ausente do banco.
    "../database/migration_012_notification_event_read_at.sql",
  ].map((relativo) =>
    readFileSync(fileURLToPath(new URL(relativo, import.meta.url)), "utf8"),
  ),
].join("\n");

describe("migration_007_service_credentials", () => {
  it("mantem o header executavel exigido pelo runner", () => {
    expect(migration.split(/\r?\n/).slice(0, 5)).toEqual([
      "-- @class: online-safe",
      "-- @requires-backup: false",
      "-- @author: spec-090",
      "-- @created: 2026-08-04",
      "-- @description: Registro de credenciais de servico por source_app e realm",
    ]);
  });

  it("e idempotente em toda criacao de objeto", () => {
    // O runner reaplica migrations; sem `IF NOT EXISTS` o segundo deploy aborta.
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS community_service_credential");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_community_service_credential_active");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS ix_community_service_credential_lookup");
    // `ADD CONSTRAINT` não aceita `IF NOT EXISTS` no Postgres 16 — o guard tem
    // que ser o bloco `DO` checando `pg_constraint`.
    expect(migration).toMatch(/SELECT 1 FROM pg_constraint[\s\S]*?community_service_credential_single_realm/);
  });

  it("nao contem DDL destrutivo (guard online-safe)", () => {
    // `validate_sql_against_class` aborta o deploy se `online-safe` trouxer
    // remoção de objeto. Falhar aqui é mais barato que falhar na VM.
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE|INDEX)\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("guarda hash Argon2id, nunca segredo em claro", () => {
    // Hash rápido aqui permitiria força bruta offline da tabela inteira.
    expect(migration).toContain("token_hash TEXT NOT NULL");
    expect(migration).toMatch(/CHECK \(token_hash LIKE '\$argon2id\$%'\)/);
  });

  it("trava um unico realm por credencial", () => {
    // É esta constraint que torna "beta grava realm=prod" impossível por
    // construção, e não por validação que alguém precisa lembrar de escrever.
    expect(migration).toContain("community_service_credential_single_realm");
    expect(migration).toMatch(/CHECK \(cardinality\(realms\) = 1\)/);
  });

  it("restringe realms e rejeita duplicata no array", () => {
    expect(migration).toMatch(/realms <@ ARRAY\['beta', 'prod'\]::TEXT\[\]/);
    expect(migration).toContain("community_text_array_has_no_duplicate(realms)");
    expect(migration).toContain("community_text_array_has_no_duplicate(scopes)");
  });

  it("deduplica por funcao IMMUTABLE, nunca por subquery no CHECK", () => {
    // `cardinality(ARRAY(SELECT DISTINCT unnest(...)))` é a forma óbvia e o
    // PostgreSQL a recusa: "cannot use subquery in check constraint". O erro só
    // aparece ao aplicar a migration — build e lint passam verdes. Reproduzido em
    // Postgres real em 2026-08-04, antes de existir esta asserção.
    expect(migration).toContain("CREATE OR REPLACE FUNCTION community_text_array_has_no_duplicate");
    expect(migration).toMatch(/community_text_array_has_no_duplicate[\s\S]{0,200}?IMMUTABLE/);
    expect(migration).not.toMatch(/CHECK \([^)]*ARRAY\(SELECT/);
  });

  it("declara exatamente os escopos que o TypeScript conhece", () => {
    // Divergência entre os dois lados só apareceria como erro de constraint no
    // deploy, depois do build verde.
    for (const scope of SERVICE_SCOPES) {
      expect(scopeMigrations, `escopo ${scope} ausente no CHECK`).toContain(`'${scope}'`);
    }
  });

  it("permite apenas uma credencial ativa por source_app, realm e slot", () => {
    // Parcial em `revoked_at IS NULL`: credencial revogada é histórico e precisa
    // continuar existindo, senão a trilha de qual credencial escreveu o quê some.
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_community_service_credential_active[\s\S]*?WHERE revoked_at IS NULL/,
    );
  });

  it("suporta a janela de rotacao current + next", () => {
    // `spec.md` §"Trust boundary e credenciais" exige publicar `next`, trocar o
    // consumidor, confirmar tráfego e só então revogar `current`. Um índice sobre
    // (source_app, realm) sem o slot tornaria essa sequência impossível e forçaria
    // downtime a cada rotação — que é como um segredo acaba nunca rotacionado.
    expect(migration).toContain("rotation_slot");
    expect(migration).toMatch(/CHECK \(rotation_slot IN \('current', 'next'\)\)/);
    expect(migration).toMatch(
      /uq_community_service_credential_active\s*\n\s*ON community_service_credential\(source_app, \(realms\[1\]\), rotation_slot\)/,
    );
  });

  it("exige motivo ao revogar", () => {
    expect(migration).toContain("community_service_credential_revocation_coherent");
    expect(migration).toMatch(/length\(btrim\(revoked_reason\)\) > 0/);
  });
});
