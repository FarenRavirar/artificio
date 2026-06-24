import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import { parseDiscordMessage, ensureSystemSuggestionForDraft } from './utils';
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
        // REV-073/076: usa parseDiscordMessage() compartilhada (D16)
        const result = await parseDiscordMessage(message, systems);
        if (!result) {
          await db.updateTable('discord_import_messages')
            .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
          continue;
        }
        const { parsed, normalized } = result;

        const existing = await db.selectFrom('discord_import_table_drafts')
          .select(['id', 'status'])
          .where('discord_message_id', '=', message.id)
          .executeTakeFirst();

        // REV-049: preservar drafts synced/rejected (igual fetch.ts)
        if (existing && existing.status !== 'synced' && existing.status !== 'rejected') {
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
          // REV-049: só marcar mensagem como parsed se draft foi atualizado
          await db.updateTable('discord_import_messages')
            .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
        } else if (!existing) {
          await db.insertInto('discord_import_table_drafts')
            .values({
              discord_message_id: message.id,
              parsed_payload: parsed,
              normalized_payload: normalized.draft,
              confidence: normalized.draft.confidence,
              status: normalized.status,
            })
            .execute();
          // REV-049: só marcar mensagem como parsed se draft foi criado
          await db.updateTable('discord_import_messages')
            .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
        }
        // REV-049: se existing é synced/rejected, não altera nem draft nem mensagem

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
