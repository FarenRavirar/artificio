import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import { processDiscordMessageToDraft, buildContentIndex, resolveReplyContext } from './utils';
import { loadCommunicationPlatformsForParser, loadSystemsForParser, loadVttPlatformsForParser } from '../../discord/shared';

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

    // Codex P2: retorno vazio precisa de discarded/ignored (toast interpola os 4 contadores).
    if (messages.length === 0) return res.json({ data: { processed: 0, succeeded: 0, discarded: 0, ignored: 0, failed: 0 } });

    // T-F8: contentIndex para resolver replyContext
    const contentIndex = buildContentIndex(messages);

    const [systems, vttPlatforms, communicationPlatforms] = await Promise.all([
      loadSystemsForParser(),
      loadVttPlatformsForParser(),
      loadCommunicationPlatformsForParser(),
    ]);
    let succeeded = 0;
    let failed = 0;
    let discarded = 0; // DEB-048-27: descartados por autoria (homebrew)
    let ignored = 0;   // não-anúncio (sem corpo / inválido)

    for (const message of messages) {
      try {
        // T-F8: resolve replyContext
        const replyContext = resolveReplyContext(message as Record<string, unknown>, contentIndex);

        // DEB-048-22: processamento compartilhado (parse → reconcile → upsert draft
        // → status → suggestion). DEB-048-27: separa descartado (autoria) de inválido.
        const outcome = await processDiscordMessageToDraft(message, systems, replyContext, req.user?.userId, true, {
          vttPlatforms,
          communicationPlatforms,
        });
        if (outcome === 'discarded') discarded++;
        else if (outcome === 'ignored') ignored++;
        else succeeded++; // 'parsed' ou 'reconciled' = válido
      } catch {
        await db.updateTable('discord_import_messages')
          .set({ status: 'error', parse_error: 'Erro no parse em lote', updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();
        failed++;
      }
    }

    // DEB-048-27: válidos=succeeded · descartados(autoria)=discarded · inválidos=ignored
    return res.json({ data: { processed: messages.length, succeeded, discarded, ignored, failed } });
    // T-G6: parse-batch NÃO registra recordImportRun — processa mensagens existentes,
    // não é uma importação nova. A rodada original já foi registrada em import.ts.
  } catch (error: any) {
    console.error('[POST /messages/parse-batch]', error);
    return res.status(500).json({ error: 'Erro ao processar mensagens em lote.' });
  }
});

export default router;
