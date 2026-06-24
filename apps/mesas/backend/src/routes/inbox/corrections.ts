import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { normalizeDraftPayload } from '../../discord';
import { requireAdmin } from '../../middleware/auth';
import { correctionSchema } from './utils';

const router = Router();

// ─── POST /drafts/:id/correction ───────────────────────────────────────────────

router.post('/:id/correction', requireAdmin, async (req: Request, res: Response) => {
  try {
    const draftId = req.params.id;
    if (!draftId || typeof draftId !== 'string') {
      return res.status(400).json({ error: 'ID do draft obrigatório.' });
    }

    const parsed = correctionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Payload inválido.' });
    }

    const { corrections, reason, before } = parsed.data;

    // Carrega draft + import_message para obter raw_text
    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'status', 'parsed_payload', 'normalized_payload', 'import_message_id'])
      .where('id', '=', draftId)
      .executeTakeFirst();

    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    if (draft.status === 'synced') return res.status(422).json({ error: 'Draft já sincronizado não pode ser corrigido.' });
    if (draft.status === 'rejected') return res.status(422).json({ error: 'Draft rejeitado não pode ser corrigido.' });

    if (!draft.import_message_id) {
      return res.status(422).json({ error: 'Draft não é de inbox (import_message_id nulo). Correções só são suportadas para mensagens inbox.' });
    }

    // Busca raw_text do import_messages (pode ser raw_text ou content_raw)
    const importMsg = await db
      .selectFrom('import_messages')
      .select(['raw_text', 'content_raw'])
      .where('id', '=', draft.import_message_id)
      .executeTakeFirst();

    const rawText = importMsg?.raw_text ?? importMsg?.content_raw ?? null;

    const parsedBefore = normalizeDraftPayload(draft.normalized_payload ?? draft.parsed_payload);
    const humanCorrected = { ...parsedBefore, table: { ...(parsedBefore?.table ?? {}), ...corrections } };

    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(corrections)) {
      const beforeVal = before?.[key] ?? (parsedBefore?.table as Record<string, unknown>)?.[key];
      const after = corrections[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(after)) {
        diff[key] = { before: beforeVal, after };
      }
    }

    const userId = (req as any).user?.userId ?? null;

    // Transação única: grava corpus + atualiza normalized_payload do draft
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('import_corrections')
        .values({
          draft_id: draftId,
          import_message_id: draft.import_message_id,
          raw_text: rawText,
          parsed_before: parsedBefore,
          human_corrected: humanCorrected,
          diff,
          reason: reason ?? null,
          corrected_by: userId,
        })
        .execute();

      await trx
        .updateTable('discord_import_table_drafts')
        .set({
          normalized_payload: humanCorrected,
          updated_at: new Date(),
        })
        .where('id', '=', draftId)
        .execute();
    });

    return res.json({ data: { draft_id: draftId, fields_corrected: Object.keys(diff).length, diff } });
  } catch (error: unknown) {
    console.error('[POST /api/v1/admin/inbox/drafts/:id/correction]', error);
    return res.status(500).json({ error: 'Erro ao registrar correção.' });
  }
});

export default router;
