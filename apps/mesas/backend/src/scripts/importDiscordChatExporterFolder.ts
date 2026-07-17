import 'dotenv/config';
import { db } from '../db/index.js';
import { processDiscordChatExporterFolder } from '../discord/chatExporterFolderImportService.js';
import { DISCORD_CHAT_EXPORTER_RETENTION } from '../discord/chatExporterAutomationConfig.js';
import type { NewDiscordImportRun } from '../db/types.js';

async function loadConfiguredRootDir(): Promise<{ enabled: boolean; importDir: string | null }> {
  const row = await db.selectFrom('discord_settings')
    .select('value')
    .where('guild_id', 'is', null)
    .where('key', '=', 'chat_exporter_config')
    .executeTakeFirst();
  if (!row) return { enabled: true, importDir: null };
  try {
    const parsed: unknown = JSON.parse(row.value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { enabled: true, importDir: null };
    const record = parsed as Record<string, unknown>;
    return {
      enabled: record.enabled !== false,
      importDir: typeof record.importDir === 'string' && record.importDir.trim() ? record.importDir.trim() : null,
    };
  } catch {
    return { enabled: true, importDir: null };
  }
}

async function recordFolderImportRun(result: Awaited<ReturnType<typeof processDiscordChatExporterFolder>>): Promise<void> {
  const totals = result.files.reduce(
    (acc, file) => {
      acc.total += file.result?.total ?? 0;
      acc.inserted += file.result?.inserted ?? 0;
      acc.updated += file.result?.updated ?? 0;
      acc.ignored += file.result?.ignored ?? 0;
      acc.failed += file.result?.failed ?? 0;
      if (file.status === 'error') acc.failed += 1;
      return acc;
    },
    { total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 },
  );

  await db.insertInto('discord_import_runs')
    .values({
      source_kind: 'discord_chat_exporter_folder',
      total_messages: totals.total,
      drafts_created: totals.inserted,
      drafts_updated: totals.updated,
      messages_ignored: totals.ignored,
      messages_failed: totals.failed,
      ended_at: new Date(),
      note: `folder=${result.rootDir}; files=${result.incoming}; processed=${result.processed}; errors=${result.errors}`,
      created_by: null,
    } as NewDiscordImportRun)
    .execute();
}

async function main() {
  const configured = await loadConfiguredRootDir();
  if (!configured.enabled) {
    console.log('[importDiscordChatExporterFolder] Desativado por configuração do admin.');
    return;
  }
  const rootDir = configured.importDir ?? process.env.DISCORD_CHAT_EXPORTER_IMPORT_DIR ?? process.argv[2];
  const allowedBaseDir = process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR
    ?? configured.importDir
    ?? process.env.DISCORD_CHAT_EXPORTER_IMPORT_DIR
    ?? process.cwd();
  if (!rootDir) {
    console.error([
      '[importDiscordChatExporterFolder] Informe DISCORD_CHAT_EXPORTER_IMPORT_DIR ou passe o diretório como argumento.',
      '[importDiscordChatExporterFolder] Base permitida: DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR, importDir configurado, DISCORD_CHAT_EXPORTER_IMPORT_DIR ou o diretório atual.',
    ].join('\n'));
    process.exit(1);
  }

  const result = await processDiscordChatExporterFolder({
    rootDir,
    allowedBaseDir,
    retention: DISCORD_CHAT_EXPORTER_RETENTION,
  });
  try {
    await recordFolderImportRun(result);
  } catch (error) {
    console.error('[importDiscordChatExporterFolder] Falha ao registrar métrica da rodada:', error instanceof Error ? error.message : error);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('[importDiscordChatExporterFolder] Erro fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
