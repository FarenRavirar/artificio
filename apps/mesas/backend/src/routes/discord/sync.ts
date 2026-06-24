import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import type { DiscordImportDraftStatus } from '../../discord';
import { syncDiscordDraftToTable, DiscordDraftSyncValidationError, DraftNotFoundError, DraftStateError } from '../../discord';

const router = Router();

router.post('/drafts/:id/sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'discord_message_id'])
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    if (!draft.discord_message_id) {
      return res.status(422).json({ error: 'Draft de inbox não suporta sync via Discord.' });
    }

    const result = await syncDiscordDraftToTable(req.params.id);
    return res.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof DraftNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof DiscordDraftSyncValidationError) {
      return res.status(422).json({ error: error.message, details: { missingFields: error.missingFields } });
    }
    if (error instanceof DraftStateError) {
      return res.status(422).json({ error: error.message });
    }
    console.error('[POST /admin/discord-sync/drafts/:id/sync]', error);
    return res.status(500).json({ error: 'Erro ao sincronizar draft.' });
  }
});

router.post('/sync-ready', requireAdmin, async (req: Request, res: Response) => {
  try {
    const readyDrafts = await db
      .selectFrom('discord_import_table_drafts')
      .select('id')
      .where('status', '=', 'ready' as DiscordImportDraftStatus)
      .where('discord_message_id', 'is not', null)
      .limit(50)
      .execute();

    const results = { synced: 0, failed: 0, errors: [] as string[] };

    for (const draft of readyDrafts) {
      try {
        await syncDiscordDraftToTable(draft.id);
        results.synced++;
      } catch (err: unknown) {
        results.failed++;
        results.errors.push(`${draft.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return res.json({ data: results });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/sync-ready]', error);
    return res.status(500).json({ error: 'Erro ao sincronizar drafts em lote.' });
  }
});

export default router;
