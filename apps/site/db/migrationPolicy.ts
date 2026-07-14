import { statSync } from "node:fs";

export type MigrationPolicy = {
  class: "online-safe" | "manual-risk";
  requiresBackup: boolean;
};

type MigrationEnvironment = Record<string, string | undefined>;

export function readMigrationPolicy(sql: string, file: string): MigrationPolicy | null {
  const classValue = /^-- @class:\s*(\S+)\s*$/m.exec(sql)?.[1];
  const backupValue = /^-- @requires-backup:\s*(\S+)\s*$/m.exec(sql)?.[1];

  // Migrations anteriores à adoção da política continuam compatíveis. Qualquer
  // arquivo novo que declare parte da política precisa declará-la por inteiro.
  if (!classValue && !backupValue) return null;
  if (!classValue || !backupValue) {
    throw new Error(`${file}: migration_policy_incomplete`);
  }
  if (classValue !== "online-safe" && classValue !== "manual-risk") {
    throw new Error(`${file}: migration_class_invalid`);
  }
  if (backupValue !== "true" && backupValue !== "false") {
    throw new Error(`${file}: migration_requires_backup_invalid`);
  }

  const policy: MigrationPolicy = {
    class: classValue,
    requiresBackup: backupValue === "true",
  };
  if (policy.class === "manual-risk" && !policy.requiresBackup) {
    throw new Error(`${file}: manual_migration_must_require_backup`);
  }
  return policy;
}

export function assertMigrationAllowed(
  file: string,
  policy: MigrationPolicy | null,
  env: MigrationEnvironment = process.env,
  backupIsValid: (path: string) => boolean = (path) => {
    try {
      const stat = statSync(path);
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  },
): void {
  if (!policy || policy.class === "online-safe") return;
  if (env.ALLOW_MANUAL_MIGRATIONS !== "true") {
    throw new Error(`${file}: manual_migration_requires_explicit_authorization`);
  }
  if (!policy.requiresBackup) return;

  const backupFile = env.MANUAL_MIGRATION_BACKUP_FILE?.trim();
  if (!backupFile || !backupIsValid(backupFile)) {
    throw new Error(`${file}: verified_backup_file_missing`);
  }
  if (env.MANUAL_MIGRATION_BACKUP_VERIFIED !== "true") {
    throw new Error(`${file}: backup_restore_or_integrity_not_verified`);
  }
  if (env.MANUAL_MIGRATION_BACKUP_OFF_VM !== "true") {
    throw new Error(`${file}: backup_off_vm_copy_not_confirmed`);
  }
}
