import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import { normalizeDiscordTableDraft, parseDiscordAnnouncement } from '../../discord';
import { parseJsonField, loadSystemsForParser, ensureSystemSuggestionForDraft } from './utils';

const router = Router();

router.post('/:id/parse', requireAdmin, async (req: Request, res: Response) => {
  try {
    const message = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    if (message.status === 'synced') {
      return res.status(422).json({ error: 'Mensagem já sincronizada como mesa. Não pode ser reparseada.' });
    }

    const systems = await loadSystemsForParser();
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
    if (!parsed) return res.status(422).json({ error: 'Mensagem sem conteudo elegivel para virar draft.' });
    const normalized = normalizeDiscordTableDraft(parsed, systems);

    const existingDraft = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'status'])
      .where('discord_message_id', '=', message.id)
      .executeTakeFirst();

    let draft;
    if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected') {
      [draft] = await db
        .updateTable('discord_import_table_drafts')
        .set({
          parsed_payload: parsed,
          normalized_payload: normalized.draft,
          confidence: normalized.draft.confidence,
          status: normalized.status,
          review_notes: null,
          updated_at: new Date(),
        })
        .where('id', '=', existingDraft.id)
        .returningAll()
        .execute();
    } else {
      [draft] = await db
        .insertInto('discord_import_table_drafts')
        .values({
          discord_message_id: message.id,
          table_id: null,
          parsed_payload: parsed,
          normalized_payload: normalized.draft,
          confidence: normalized.draft.confidence,
          status: normalized.status,
          review_notes: null,
        })
        .returningAll()
        .execute();
    }

    await db
      .updateTable('discord_import_messages')
      .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
      .where('id', '=', message.id)
      .execute();

    await ensureSystemSuggestionForDraft(
      normalized.draft,
      req.user?.userId,
      message.discord_thread_name ?? message.discord_message_id,
    );

    return res.json({ data: draft });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/messages/:id/parse]', error);
    const parseError = error instanceof Error ? error.message : 'Erro ao parsear mensagem.';
    await db
      .updateTable('discord_import_messages')
      .set({ parse_error: parseError, updated_at: new Date() })
      .where('id', '=', req.params.id)
      .execute();
    return res.status(500).json({ error: 'Erro ao parsear mensagem.' });
  }
});

export default router;
