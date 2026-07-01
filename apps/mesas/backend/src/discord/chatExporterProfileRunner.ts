import { mkdir } from 'fs/promises';
import path from 'path';
import { db } from '../db';
import type { DiscordChatExporterProfile, NewDiscordImportRun } from '../db/types';
import { DISCORD_CHAT_EXPORTER_RETENTION } from './chatExporterAutomationConfig';
import { runChatExporterCli } from './chatExporterCliRunner';
import { processDiscordChatExporterFolder } from './chatExporterFolderImportService';

/** Binário resolvido só no servidor (env/deploy), nunca a partir de payload — evita execução arbitrária. */
export function resolveChatExporterBinary(): string {
  return process.env.DISCORD_CHAT_EXPORTER_BIN?.trim() || 'DiscordChatExporter.Cli';
}

/** Importa a pasta do perfil e registra a rodada em discord_import_runs. */
export async function runFolderImport(rootDir: string, userId: string | undefined) {
  const result = await processDiscordChatExporterFolder({
    rootDir,
    retention: DISCORD_CHAT_EXPORTER_RETENTION,
  });
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
      source_kind: 'discord_chat_exporter_manual',
      total_messages: totals.total,
      drafts_created: totals.inserted,
      drafts_updated: totals.updated,
      messages_ignored: totals.ignored,
      messages_failed: totals.failed,
      ended_at: new Date(),
      note: `manual folder=${result.rootDir}; files=${result.incoming}; processed=${result.processed}; errors=${result.errors}`,
      created_by: userId ?? null,
    } as NewDiscordImportRun)
    .execute();

  return result;
}

/** Exporta o canal do perfil via CLI, importa a pasta e atualiza saúde do perfil. */
export async function runProfileExport(
  profile: DiscordChatExporterProfile,
  token: string,
  userId: string | undefined,
) {
  const incomingDir = path.join(profile.import_dir, 'incoming');
  await mkdir(incomingDir, { recursive: true });
  const exportResult = await runChatExporterCli({
    binary: resolveChatExporterBinary(),
    token,
    channelId: profile.channel_id,
    outputDir: incomingDir,
    after: profile.after?.toISOString(),
  });
  const importResult = await runFolderImport(profile.import_dir, userId);
  await db.updateTable('discord_chat_exporter_profiles')
    .set({
      last_run_at: new Date(),
      last_status: importResult.errors > 0 ? 'error' : 'success',
      last_error: importResult.errors > 0 ? `${importResult.errors} arquivo(s) com erro.` : null,
      updated_at: new Date(),
    })
    .where('id', '=', profile.id)
    .execute();
  return { exported: exportResult, imported: importResult };
}
