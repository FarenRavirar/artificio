import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { importDiscordChatExporterJson, extractJsonPayload } from '../../discord/chatExporterImportService';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { db } from '../../db';
import { parseDiscordMessage, ensureSystemSuggestionForDraft, reconcileTerminalDraft } from './utils';

const router = Router();

router.post('/', requireAdmin, async (req: Request, res: Response) => {

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const result = await importDiscordChatExporterJson(extracted.payload);

    return res.json({
      data: {
        total: result.total,
        inserted: result.inserted,
        updated: result.updated,
        ignored: result.ignored,
        failed: result.failed,
      },
    });
  } catch (error: unknown) {
    if (error instanceof DiscordChatExporterValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[POST /admin/discord-sync/import-json]', error instanceof Error ? error.message : 'unknown error');
    return res.status(500).json({ error: 'Erro ao importar JSON do DiscordChatExporter.' });
  }
});

// POST /import-json/reparse — reprocessa mensagens DiscordChatExporter pendentes
router.post('/reparse', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { messageIds }: { messageIds?: string[] } = req.body ?? {};

    let query = db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('source_kind', '=', 'discord_chat_exporter_json')
      .where('status', 'in', ['pending', 'needs_review']);

    if (messageIds && messageIds.length > 0) {
      query = query.where('discord_message_id', 'in', messageIds as any);
    }

    const messages = await query.limit(500).execute();

    if (messages.length === 0) {
      return res.json({ data: { total: 0, reparsed: 0, errors: 0 } });
    }

    let reparsed = 0;
    let errors = 0;

    for (const message of messages) {
      try {
        // Não reprocessa mensagens synced (segurança extra)
        if (message.status === 'synced') continue;

        const result = await parseDiscordMessage(message);
        if (!result) {
          await db.updateTable('discord_import_messages')
            .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
          reparsed++;
          continue;
        }
        const { parsed, normalized } = result;

        const existing = await db.selectFrom('discord_import_table_drafts')
          .select(['id', 'status'])
          .where('discord_message_id', '=', message.id)
          .executeTakeFirst();

        // Reconcilia draft terminal (synced/rejected) — não mexe
        if (await reconcileTerminalDraft(existing, message.id)) {
          reparsed++;
          continue;
        }

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

        reparsed++;
      } catch {
        await db.updateTable('discord_import_messages')
          .set({ status: 'error', parse_error: 'Erro no reparse em lote', updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();
        errors++;
      }
    }

    return res.json({
      data: {
        total: messages.length,
        reparsed,
        errors,
      },
    });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/import-json/reparse]', error instanceof Error ? error.message : 'unknown error');
    return res.status(500).json({ error: 'Erro ao reprocessar mensagens do DiscordChatExporter.' });
  }
});

export default router;
