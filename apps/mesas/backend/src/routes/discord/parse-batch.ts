import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import { parseDiscordMessage, ensureSystemSuggestionForDraft, reconcileTerminalDraft } from './utils';
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

        // REV-077: reconciliar mensagem se draft já é terminal → interrompe fluxo
        if (await reconcileTerminalDraft(existing, message.id)) {
          succeeded++;
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
        // REV-077: status da mensagem atualizado dentro dos branches acima
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
