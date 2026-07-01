import 'dotenv/config';
import { db } from '../db';
import type { DiscordChatExporterProfile } from '../db/types';
import { selectDueProfiles } from '../discord/chatExporterSchedule';
import { runProfileExport } from '../discord/chatExporterProfileRunner';
import { decryptDiscordSetting } from '../discord/settingsCrypto';

const LOG = '[discord-chat-exporter-schedule]';

/** Token global (fallback quando o perfil não tem token próprio). */
async function globalToken(): Promise<string | null> {
  const row = await db.selectFrom('discord_settings')
    .select('value')
    .where('guild_id', 'is', null)
    .where('key', '=', 'chat_exporter_token')
    .executeTakeFirst();
  return row?.value ? decryptDiscordSetting(row.value) : null;
}

async function resolveToken(profile: DiscordChatExporterProfile, fallback: string | null): Promise<string | null> {
  if (profile.token_enc) return decryptDiscordSetting(profile.token_enc);
  return fallback;
}

async function main(): Promise<void> {
  const now = new Date();
  const profiles = await db
    .selectFrom('discord_chat_exporter_profiles')
    .selectAll()
    .where('schedule_enabled', '=', true)
    .where('enabled', '=', true)
    .execute();

  const due = selectDueProfiles(profiles, now);
  console.log(`${LOG} perfis agendados: ${profiles.length}; prontos agora: ${due.length}`);
  if (due.length === 0) return;

  const fallback = await globalToken();

  for (const profile of due) {
    try {
      const token = await resolveToken(profile, fallback);
      if (!token) {
        console.error(`${LOG} ${profile.label}: sem token (global ou do perfil). Pulando.`);
        await db.updateTable('discord_chat_exporter_profiles')
          .set({ last_status: 'error', last_error: 'Token ausente no agendamento.', updated_at: new Date() })
          .where('id', '=', profile.id)
          .execute();
        continue;
      }
      const result = await runProfileExport(profile, token, undefined);
      console.log(`${LOG} ${profile.label}: ${result.imported.processed} arquivo(s), ${result.imported.errors} erro(s).`);
    } catch (error: unknown) {
      console.error(`${LOG} ${profile.label}: erro`, error instanceof Error ? error.message : error);
      await db.updateTable('discord_chat_exporter_profiles')
        .set({ last_status: 'error', last_error: error instanceof Error ? error.message : 'Erro desconhecido.', updated_at: new Date() })
        .where('id', '=', profile.id)
        .execute()
        .catch(() => undefined);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`${LOG} erro fatal:`, error);
    process.exit(1);
  });
