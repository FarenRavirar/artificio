import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { requireAdmin } from '../../middleware/auth.js';
import { parseDiscordMessage, ensureSystemSuggestionForDraft } from './utils.js';

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

    const result = await parseDiscordMessage(message);
    if (!result) {
      // REV-068: marcar como ignorada para não ficar pendente eternamente
      await db.updateTable('discord_import_messages')
        .set({ status: 'ignored', parse_error: 'Mensagem sem conteúdo elegível para virar draft.', updated_at: new Date() })
        .where('id', '=', message.id)
        .execute();
      return res.status(422).json({ error: 'Mensagem sem conteudo elegivel para virar draft.' });
    }
    const { parsed, normalized } = result;

    const existingDraft = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'status'])
      .where('discord_message_id', '=', message.id)
      .executeTakeFirst();

    let draft;
    if (existingDraft) {
      if (existingDraft.status === 'synced') {
        return res.status(422).json({ error: 'Draft já sincronizado como mesa.' });
      }
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
    console.error('[POST /admin/discord/messages/:id/parse]', error);
    const parseError = error instanceof Error ? error.message : 'Erro ao parsear mensagem.';
    await db
      .updateTable('discord_import_messages')
      .set({ status: 'error', parse_error: parseError, updated_at: new Date() })
      .where('id', '=', req.params.id)
      .execute();
    return res.status(500).json({ error: 'Erro ao parsear mensagem.' });
  }
});

export default router;
