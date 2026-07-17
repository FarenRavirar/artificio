import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { DraftNotFoundError, DraftStateError } from '../../discord/syncHelpers.js';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft, normalizeDraftPayload } from '../../discord/index.js';
import { stripSeparatorLines } from '../../discord/parseDiscordAnnouncement.js';
import { requireAdmin } from '../../middleware/auth.js';
import { textToRawMessage } from '../../inbox/adapters/textToRawMessage.js';
import { syncImportDraftToTable, DraftSyncValidationError } from '../../inbox/syncImportDraftToTable.js';
import { handlePatchDraft } from '../discord/utils.js';
import { loadSystemsForParser } from '../../discord/shared.js';
import { toNumberOrNull, listDraftsSchema } from './utils.js';
import type { DiscordImportDraftStatus } from '../../db/types.js';

const router = Router();

// ─── GET /drafts ──────────────────────────────────────────────────────────────

router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = listDraftsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parâmetros inválidos.', details: z.flattenError(parsed.error) });
    }
    const { status, limit = '50', offset = '0', origin } = parsed.data;

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
      query = query.where('discord_import_table_drafts.status', '=', status as DiscordImportDraftStatus);
    }
    if (origin) {
      query = query.where('import_messages.source_type', '=', origin);
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
    console.error('[GET /api/v1/admin/import/drafts]', error);
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

    const adminDisplayName = req.user?.name ?? undefined;

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
    console.error('[POST /api/v1/admin/import/drafts/:id/sync]', error);
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
        'import_messages.content_raw',
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

    const mergedRawContent = row.content_raw || row.raw_text;

    return res.json({
      data: {
        ...row,
        raw_text: row.raw_text,
        // Fase I (spec 058): contrato unificado com o draft de Discord — mesmo
        // campo `content_raw` no payload, pro editor não precisar saber a origem.
        content_raw: mergedRawContent ? stripSeparatorLines(mergedRawContent) : null,
        confidence: toNumberOrNull(row.confidence),
      },
    });
  } catch (error: unknown) {
    console.error('[GET /api/v1/admin/import/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar draft.' });
  }
});

// ─── PATCH /drafts/:id ────────────────────────────────────────────────────────

router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await handlePatchDraft(req, {
      preTransitionChecks: (current, _data) => {
        const importMsgId = current.import_message_id as string | null;
        if (!importMsgId) {
          return { status: 422, body: { error: 'Draft de Discord não pode ser editado via Inbox.' } };
        }
        if (current.status === 'synced') {
          return { status: 422, body: { error: 'Draft já sincronizado não pode ser alterado.' } };
        }
        return null;
      },
      postTransitionChecks: (_current, data) => {
        if (data.normalized_payload) {
          const table = (data.normalized_payload as Record<string, unknown>).table as Record<string, unknown> | undefined;
          if (table?.status === 'published') {
            return { status: 422, body: { error: 'Não é permitido publicar mesa diretamente. Use status "draft".' } };
          }
        }
        return null;
      },
    });

    if (result.status === 200) {
      const body = result.body as { data: Record<string, unknown> };
      return res.json({ data: { ...body.data, confidence: toNumberOrNull(body.data.confidence) } });
    }
    return res.status(result.status).json(result.body);
  } catch (error: unknown) {
    console.error('[PATCH /api/v1/admin/import/drafts/:id]', error);
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

    // REV-062: guarda contra draft removido entre check e update
    if (!updated) {
      return res.status(404).json({ error: 'Draft não encontrado.' });
    }

    return res.json({ data: updated });
  } catch (error: unknown) {
    console.error('[POST /api/v1/admin/import/drafts/:id/reparse]', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao reparsar draft.' });
  }
});

export default router;
