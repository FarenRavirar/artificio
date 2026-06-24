import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft } from '../../discord';
import { parseJsonField, ensureSystemSuggestionForDraft } from './utils';
import { loadSystemsForParser } from '../../discord/shared';

const router = Router();

// POST /parse-batch — parseia todas as mensagens pendentes em lote
router.post('/parse-batch', requireAdmin, async (req: Request, res: Response) => {
  try {
    const messages = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('status', 'in', ['pending', 'error'])
      .limit(200)
      .execute();

    if (messages.length === 0) return res.json({ data: { processed: 0, succeeded: 0, failed: 0 } });

    const systems = await loadSystemsForParser();
    let succeeded = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        const parsed = parseDiscordAnnouncement({
          source_kind: message.source_kind,
          discord_message_id: message.discord_message_id,
          discord_channel_id: message.discord_channel_id,
          discord_guild_id: message.discord_guild_id,
          discord_parent_channel_id: message.discord_parent_channel_id,
          discord_thread_id: message.discord_thread_id,
          discord_thread_name: message.discord_thread_name,
          discord_author_id: message.discord_author_id,
          discord_author_name: message.discord_author_name,
          discord_message_url: message.discord_message_url,
          content_raw: message.content_raw,
          attachments: parseJsonField(message.attachments),
          embeds: parseJsonField(message.embeds),
          message_created_at: message.message_created_at,
          message_edited_at: message.message_edited_at,
        }, systems);
        if (!parsed) {
          await db.updateTable('discord_import_messages')
            .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
          continue;
        }
        const normalized = normalizeDiscordTableDraft(parsed, systems);

        const existing = await db.selectFrom('discord_import_table_drafts')
          .select('id')
          .where('discord_message_id', '=', message.id)
          .executeTakeFirst();

        if (existing) {
          await db.updateTable('discord_import_table_drafts')
            .set({
              parsed_payload: parsed,
              normalized_payload: normalized.draft,
              confidence: normalized.draft.confidence,
              status: normalized.status,
              updated_at: new Date(),
            })
            .where('id', '=', existing.id)
            .execute();
        } else {
          await db.insertInto('discord_import_table_drafts')
            .values({
              discord_message_id: message.id,
              parsed_payload: parsed,
              normalized_payload: normalized.draft,
              confidence: normalized.draft.confidence,
              status: normalized.status,
            })
            .execute();
        }

        await db.updateTable('discord_import_messages')
          .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();

        await ensureSystemSuggestionForDraft(
          normalized.draft,
          req.user?.userId,
          message.discord_thread_name ?? message.discord_message_id,
        );

        succeeded++;
      } catch {
        await db.updateTable('discord_import_messages')
          .set({ status: 'error', parse_error: 'Erro no parse em lote', updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();
        failed++;
      }
    }

    return res.json({ data: { processed: messages.length, succeeded, failed } });
  } catch (error: any) {
    console.error('[POST /messages/parse-batch]', error);
    return res.status(500).json({ error: 'Erro ao processar mensagens em lote.' });
  }
});

export default router;
