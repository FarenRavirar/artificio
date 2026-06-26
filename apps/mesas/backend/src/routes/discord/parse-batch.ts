import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import { processDiscordMessageToDraft, buildContentIndex, resolveReplyContext } from './utils';
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

    // T-F8: contentIndex para resolver replyContext
    const contentIndex = buildContentIndex(messages);

    const systems = await loadSystemsForParser();
    let succeeded = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        // T-F8: resolve replyContext
        const replyContext = resolveReplyContext(message as Record<string, unknown>, contentIndex);

        // DEB-048-22: processamento compartilhado (parse → reconcile → upsert draft
        // → status → suggestion). 'ignored' não conta como sucesso.
        const outcome = await processDiscordMessageToDraft(message, systems, replyContext, req.user?.userId);
        if (outcome !== 'ignored') succeeded++;
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
