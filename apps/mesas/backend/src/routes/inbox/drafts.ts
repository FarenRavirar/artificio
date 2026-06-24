import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { DraftNotFoundError, DraftStateError } from '../../discord/syncHelpers';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft, normalizeDraftPayload } from '../../discord';
import { requireAdmin } from '../../middleware/auth';
import { textToRawMessage } from '../../inbox/adapters/textToRawMessage';
import { syncImportDraftToTable, DraftSyncValidationError } from '../../inbox/syncImportDraftToTable';
import { validateDraftStatusTransition } from '../discord/utils';
import { loadSystemsForParser } from '../../discord/shared';
import { toNumberOrNull, listDraftsSchema, patchDraftSchema } from './utils';

const router = Router();

// ─── GET /drafts ──────────────────────────────────────────────────────────────

router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0', origin } = listDraftsSchema.parse(req.query);

    let query = db
      .selectFrom('discord_import_table_drafts')
      .innerJoin('import_messages', 'import_messages.id', 'discord_import_table_drafts.import_message_id')
      .select([
        'discord_import_table_drafts.id',
        'discord_import_table_drafts.status',
        'discord_import_table_drafts.confidence',
        'discord_import_table_drafts.normalized_payload',
        'discord_import_table_drafts.created_at',
        'import_messages.source_type',
        'import_messages.raw_text',
      ])
      .orderBy('discord_import_table_drafts.created_at', 'desc')
      .limit(Math.min(Number(limit) || 50, 100))
      .offset(Number(offset) || 0);

    if (status) {
      query = query.where('discord_import_table_drafts.status', '=', status as any);
    }
    if (origin) {
      query = query.where('import_messages.source_type', '=', origin as any);
    }

    const rows = await query.execute();

    const drafts = rows.map((row) => {
      const payload = normalizeDraftPayload(row.normalized_payload);
      const table = normalizeDraftPayload(payload?.table);
      return {
        id: row.id,
        source_type: row.source_type,
        raw_text: row.raw_text,
        status: row.status,
        confidence: toNumberOrNull(row.confidence),
        title: table.title ?? null,
        created_at: row.created_at,
      };
    });

    return res.json({ data: drafts });
  } catch (error: unknown) {
    console.error('[GET /api/v1/admin/inbox/drafts]', error);
    return res.status(500).json({ error: 'Erro ao listar drafts do inbox.' });
  }
});

// ─── POST /drafts/:id/sync ────────────────────────────────────────────────────

router.post('/:id/sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    const draftId = req.params.id;
    if (!draftId || typeof draftId !== 'string') {
      return res.status(400).json({ error: 'ID do draft obrigatório.' });
    }

    const adminDisplayName =
      (req as any).user?.displayName ?? (req as any).user?.name ?? undefined;

    const result = await syncImportDraftToTable(draftId, adminDisplayName);
    return res.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof DraftNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof DraftSyncValidationError) {
      return res.status(422).json({ error: error.message, missing_fields: error.missingFields });
    }
    if (error instanceof DraftStateError) {
      return res.status(422).json({ error: error.message });
    }
    console.error('[POST /api/v1/admin/inbox/drafts/:id/sync]', error);
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar draft.';
    return res.status(500).json({ error: message });
  }
});

// ─── GET /drafts/:id ──────────────────────────────────────────────────────────

router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const row = await db
      .selectFrom('discord_import_table_drafts')
      .innerJoin('import_messages', 'import_messages.id', 'discord_import_table_drafts.import_message_id')
      .select([
        'discord_import_table_drafts.id',
        'discord_import_table_drafts.discord_message_id',
        'discord_import_table_drafts.import_message_id',
        'discord_import_table_drafts.table_id',
        'discord_import_table_drafts.parsed_payload',
        'discord_import_table_drafts.normalized_payload',
        'discord_import_table_drafts.confidence',
        'discord_import_table_drafts.status',
        'discord_import_table_drafts.review_notes',
        'discord_import_table_drafts.image_upload_status',
        'discord_import_table_drafts.image_upload_attempts',
        'discord_import_table_drafts.image_upload_last_error',
        'discord_import_table_drafts.image_upload_last_at',
        'discord_import_table_drafts.created_at',
        'discord_import_table_drafts.updated_at',
        'import_messages.raw_text',
      ])
      .where('discord_import_table_drafts.id', '=', req.params.id)
      .executeTakeFirst();

    if (!row) {
      const noJoin = await db
        .selectFrom('discord_import_table_drafts')
        .select(['id', 'import_message_id'])
        .where('id', '=', req.params.id)
        .executeTakeFirst();
      if (!noJoin) return res.status(404).json({ error: 'Draft não encontrado.' });
      if (!noJoin.import_message_id) {
        return res.status(422).json({ error: 'Draft de Discord não acessível via Inbox.' });
      }
      return res.status(500).json({ error: 'Mensagem de origem não encontrada.' });
    }

    return res.json({
      data: {
        ...row,
        raw_text: row.raw_text,
        confidence: toNumberOrNull(row.confidence),
      },
    });
  } catch (error: unknown) {
    console.error('[GET /api/v1/admin/inbox/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar draft.' });
  }
});

// ─── PATCH /drafts/:id ────────────────────────────────────────────────────────

router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const parsed = patchDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
  }
  try {
    const draftId = req.params.id;

    const current = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'status', 'import_message_id', 'normalized_payload'])
      .where('id', '=', draftId)
      .executeTakeFirst();

    if (!current) return res.status(404).json({ error: 'Draft não encontrado.' });
    if (!current.import_message_id) {
      return res.status(422).json({ error: 'Draft de Discord não pode ser editado via Inbox.' });
    }
    if (current.status === 'synced') {
      return res.status(422).json({ error: 'Draft já sincronizado não pode ser alterado.' });
    }

    if (parsed.data.status && parsed.data.status !== current.status) {
      const transition = validateDraftStatusTransition(parsed.data, current);
      if (!transition.allowed) {
        return res.status(422).json({
          error: transition.reason ?? "Draft não pode ser marcado como 'ready'.",
          details: { missing_fields: transition.missingFields ?? [] },
        });
      }
    }

    if (parsed.data.normalized_payload) {
      const table = (parsed.data.normalized_payload as Record<string, unknown>).table as Record<string, unknown> | undefined;
      if (table?.status === 'published') {
        return res.status(422).json({ error: 'Não é permitido publicar mesa diretamente. Use status "draft".' });
      }
    }

    const [draft] = await db
      .updateTable('discord_import_table_drafts')
      .set({ ...parsed.data, updated_at: new Date() })
      .where('id', '=', draftId)
      .returningAll()
      .execute();

    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    return res.json({ data: { ...draft, confidence: toNumberOrNull(draft.confidence) } });
  } catch (error: unknown) {
    console.error('[PATCH /api/v1/admin/inbox/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar draft.' });
  }
});

// ─── POST /drafts/:id/reparse ─────────────────────────────────────────────────

router.post('/:id/reparse', requireAdmin, async (req: Request, res: Response) => {
  try {
    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    if (draft.status === 'synced') {
      return res.status(422).json({ error: 'Draft já sincronizado. Não pode ser reparseado.' });
    }
    if (!draft.import_message_id) {
      return res.status(422).json({ error: 'Draft de Discord não suporta reparse via Inbox.' });
    }

    const importMsg = await db
      .selectFrom('import_messages')
      .select(['content_raw', 'raw_text', 'thread_name'])
      .where('id', '=', draft.import_message_id)
      .executeTakeFirst();

    if (!importMsg) return res.status(404).json({ error: 'Mensagem de origem não encontrada.' });

    const rawContent = importMsg.content_raw || importMsg.raw_text || '';
    const rawMessage = textToRawMessage(rawContent, importMsg.thread_name ?? undefined);
    const systems = await loadSystemsForParser();
    const parsed = parseDiscordAnnouncement(rawMessage, systems);

    if (!parsed) {
      await db
        .updateTable('import_messages')
        .set({ status: 'error', parse_error: 'Mensagem sem conteúdo elegível para virar draft.' })
        .where('id', '=', draft.import_message_id)
        .execute();
      return res.status(422).json({ error: 'Mensagem sem conteúdo elegível para virar draft.' });
    }

    const normalized = normalizeDiscordTableDraft(parsed, systems);

    const [updated] = await db.transaction().execute(async (trx) => {
      const [result] = await trx
        .updateTable('discord_import_table_drafts')
        .set({
          parsed_payload: parsed,
          normalized_payload: normalized.draft,
          confidence: normalized.draft.confidence,
          status: normalized.status,
          updated_at: new Date(),
        })
        .where('id', '=', req.params.id)
        .returningAll()
        .execute();

      await trx
        .updateTable('import_messages')
        .set({ status: 'parsed', parse_error: null })
        .where('id', '=', draft.import_message_id)
        .execute();

      return [result];
    });

    return res.json({ data: updated });
  } catch (error: unknown) {
    console.error('[POST /api/v1/admin/inbox/drafts/:id/reparse]', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao reparsar draft.' });
  }
});

export default router;
