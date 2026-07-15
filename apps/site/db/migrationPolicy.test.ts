import { describe, expect, it } from "vitest";
import { assertMigrationAllowed, readMigrationPolicy } from "./migrationPolicy";

const manualSql = `-- @class: manual-risk
-- @requires-backup: true
SELECT 1;`;

describe("migration policy", () => {
  it("keeps historical migrations without headers compatible", () => {
    expect(readMigrationPolicy("SELECT 1;", "001.sql")).toBeNull();
  });

  it("rejects incomplete or unsafe manual metadata", () => {
    expect(() => readMigrationPolicy("-- @class: manual-risk", "008.sql"))
      .toThrow("migration_policy_incomplete");
    expect(() => readMigrationPolicy(
      "-- @class: manual-risk\n-- @requires-backup: false",
      "008.sql",
    )).toThrow("manual_migration_must_require_backup");
  });

  it("ignores policy markers outside the first 20 lines", () => {
    const sql = `${Array.from({ length: 20 }, () => "-- header").join("\n")}\n-- @class: manual-risk\n-- @requires-backup: true`;
    expect(readMigrationPolicy(sql, "legacy.sql")).toBeNull();
  });

  it("ignores policy markers after SQL inside the first 20 lines", () => {
    const sql = "SELECT 1;\n-- @class: manual-risk\n-- @requires-backup: true";
    expect(readMigrationPolicy(sql, "legacy.sql")).toBeNull();
  });

  it("ignores policy-like text inside a multiline SQL string", () => {
    const sql = "DO $$\n-- @class: manual-risk\n-- @requires-backup: true\nBEGIN\n  NULL;\nEND\n$$;";
    expect(readMigrationPolicy(sql, "legacy.sql")).toBeNull();
  });

  it("blocks manual migration without explicit authorization and backup evidence", () => {
    const policy = readMigrationPolicy(manualSql, "009.sql");
    expect(() => assertMigrationAllowed("009.sql", policy, {}))
      .toThrow("manual_migration_requires_explicit_authorization");
    expect(() => assertMigrationAllowed("009.sql", policy, {
      ALLOW_MANUAL_MIGRATIONS: "true",
    })).toThrow("verified_backup_file_missing");
  });

  it("allows manual migration only with all backup attestations", () => {
    const policy = readMigrationPolicy(manualSql, "009.sql");
    expect(() => assertMigrationAllowed("009.sql", policy, {
      ALLOW_MANUAL_MIGRATIONS: "true",
      MANUAL_MIGRATION_BACKUP_FILE: "C:/backup/site.dump",
      MANUAL_MIGRATION_BACKUP_VERIFIED: "true",
      MANUAL_MIGRATION_BACKUP_OFF_VM: "true",
    }, () => true)).not.toThrow();
  });
});
