import 'dotenv/config';
import { z } from 'zod';
import { db } from '../db';
import type { DiscordChatExporterProfile } from '../db/types';
import { getDiscordBotToken } from '../discord/config';
import { selectDueProfiles } from '../discord/chatExporterSchedule';
import { runProfileExport } from '../discord/chatExporterProfileRunner';
import { decryptDiscordSetting } from '../discord/settingsCrypto';

const LOG = '[discord-chat-exporter-schedule]';

async function setting(key: string): Promise<string | null> {
  const row = await db.selectFrom('discord_settings')
    .select('value')
    .where('guild_id', 'is', null)
    .where('key', '=', key)
    .executeTakeFirst();
  return row?.value ?? null;
}

async function globalUserToken(): Promise<string | null> {
  const value = await setting('chat_exporter_token');
  return value ? decryptDiscordSetting(value) : null;
}

const storedConfigAuthTypeSchema = z.object({ authType: z.enum(['user', 'bot']).optional() }).partial();

async function globalAuthType(): Promise<'user' | 'bot'> {
  const value = await setting('chat_exporter_config');
  if (!value) return 'user';
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return 'user';
  }
  const parsed = storedConfigAuthTypeSchema.safeParse(raw);
  return parsed.success && parsed.data.authType === 'bot' ? 'bot' : 'user';
}

async function resolveToken(profile: DiscordChatExporterProfile): Promise<string | null> {
  if (profile.token_enc) return decryptDiscordSetting(profile.token_enc);
  const mode = profile.auth_type === 'global' ? await globalAuthType() : profile.auth_type;
  return mode === 'bot' ? (await getDiscordBotToken() ?? null) : globalUserToken();
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

  for (const profile of due) {
    try {
      const token = await resolveToken(profile);
      if (!token) {
        console.error(`${LOG} ${profile.label}: sem token compatível (global ou do perfil). Pulando.`);
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
