import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { DraftNotFoundError, DraftStateError } from '../discord/syncHelpers';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft, normalizeDraftPayload } from '../discord';
import { assertDraftReadyTransition } from '../discord/draftValidation';
import { authMiddleware } from '../middleware/auth';
import { textToRawMessage } from '../inbox/adapters/textToRawMessage';
import { segmentAnnouncements } from '../inbox/segmentation';
import { syncImportDraftToTable, DraftSyncValidationError } from '../inbox/syncImportDraftToTable';
import { loadSystemsForParser } from './discord/utils';
import { toNumberOrNull, isAdmin, importTextSchema, listDraftsSchema, patchDraftSchema, correctionSchema } from './inbox/utils';

const router = Router();

// ─── POST /import-text ────────────────────────────────────────────────────────

router.post('/import-text', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const parsed = importTextSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Payload inválido.' });
    }

    const { text, title_hint } = parsed.data;
    const systems = await loadSystemsForParser();
    const segments = segmentAnnouncements(text);

    const created: Array<{
      id: string;
      title: string | null;
      status: string;
      confidence: number | null;
      missing_fields: string[];
    }> = [];

    for (const segment of segments) {
      const contentHash = crypto.createHash('sha256').update(segment).digest('hex');

      const existingMessage = await db
        .selectFrom('import_messages')
        .select(['id'])
        .where('content_hash', '=', contentHash)
        .executeTakeFirst();

      if (existingMessage) {
        const existingDraft = await db
          .selectFrom('discord_import_table_drafts')
          .select(['id', 'status', 'confidence', 'normalized_payload'])
          .where('import_message_id', '=', existingMessage.id)
          .executeTakeFirst();

        if (existingDraft) {
          const payload = normalizeDraftPayload(existingDraft.normalized_payload);
          const table = payload.table as Record<string, unknown> | undefined;
          const missingFields: string[] = [];
          if (!table?.title) missingFields.push('title');
          if (!table?.system_id) missingFields.push(table?.raw_system_hint ? 'system_name:unmatched_hint' : 'system_name');
          if (!table?.type) missingFields.push('type');
          if (!table?.modality) missingFields.push('modality');
          if (table?.slots_total == null && table?.slots_open == null) missingFields.push('slots_total');

          created.push({
            id: existingDraft.id,
            title: (table?.title as string) ?? null,
            status: existingDraft.status,
            confidence: toNumberOrNull(existingDraft.confidence),
            missing_fields: missingFields,
          });
          continue;
        }
      }

      let importMessageId: string;
      if (existingMessage) {
        importMessageId = existingMessage.id;
      } else {
        const [inserted] = await db
          .insertInto('import_messages')
          .values({
            source_type: 'manual_paste',
            raw_text: segment,
            content_raw: segment,
            thread_name: title_hint ?? null,
            content_hash: contentHash,
            status: 'pending',
          })
          .returning('id')
          .execute();
        if (!inserted) continue;
        importMessageId = inserted.id;
      }

      const rawMessage = textToRawMessage(segment, title_hint);
      const parsedDraft = parseDiscordAnnouncement(rawMessage, systems);

      if (!parsedDraft) {
        await db
          .updateTable('import_messages')
          .set({ status: 'error', parse_error: 'Mensagem sem conteúdo elegível para virar draft.' })
          .where('id', '=', importMessageId)
          .execute();
        continue;
      }

      const enrichedDraft = normalizeDiscordTableDraft(parsedDraft, systems);

      const normalized = enrichedDraft;

      const [draftRow] = await db
        .insertInto('discord_import_table_drafts')
        .values({
          discord_message_id: null,
          import_message_id: importMessageId,
          parsed_payload: parsedDraft,
          normalized_payload: normalized.draft,
          confidence: normalized.draft.confidence,
          status: normalized.status,
        })
        .returning(['id', 'status', 'confidence'])
        .execute();

      await db
        .updateTable('import_messages')
        .set({ status: 'parsed' })
        .where('id', '=', importMessageId)
        .execute();

      const missingFields: string[] = [];
      const table = normalized.draft.table;
      if (!table.title) missingFields.push('title');
      if (!table.system_id) missingFields.push(table.raw_system_hint ? 'system_name:unmatched_hint' : 'system_name');
      if (!table.type) missingFields.push('type');
      if (!table.modality) missingFields.push('modality');
      if (table.slots_total == null && table.slots_open == null) missingFields.push('slots_total');

      created.push({
        id: draftRow.id,
        title: table.title ?? null,
        status: draftRow.status,
        confidence: toNumberOrNull(draftRow.confidence),
        missing_fields: missingFields,
      });
    }

    return res.json({
      data: {
        segments_found: segments.length,
        drafts_created: created.length,
        drafts: created,
      },
    });
  } catch (error: unknown) {
    console.error('[POST /api/v1/admin/inbox/import-text]', error);
    return res.status(500).json({ error: 'Erro ao importar texto.' });
  }
});

// ─── GET /drafts ──────────────────────────────────────────────────────────────

router.get('/drafts', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
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

router.post('/drafts/:id/sync', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
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

router.get('/drafts/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
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

router.patch('/drafts/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
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
      const patchPayload = normalizeDraftPayload(parsed.data.normalized_payload ?? current.normalized_payload);
      const currentPayload = normalizeDraftPayload(current.normalized_payload);
      const transition = assertDraftReadyTransition({
        patchStatus: parsed.data.status,
        patchPayloadMissing: patchPayload?.missing_fields,
        currentPayloadMissing: currentPayload?.missing_fields,
      });
      if (!transition.allowed) {
        return res.status(422).json({ error: transition.reason, missing_fields: transition.missingFields });
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

router.post('/drafts/:id/reparse', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
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

// ─── POST /drafts/:id/correction ──────────────────────────────────────────────

router.post('/drafts/:id/correction', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
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

// ─── GET /metrics ─────────────────────────────────────────────────────────────

router.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const totalDrafts = await db
      .selectFrom('import_corrections')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    const fieldsByCount = await db
      .selectFrom('import_corrections')
      .select('diff')
      .execute();

    const fieldCounts: Record<string, number> = {};
    for (const row of fieldsByCount) {
      const diff = row.diff as Record<string, unknown>;
      if (diff && typeof diff === 'object') {
        for (const key of Object.keys(diff)) {
          fieldCounts[key] = (fieldCounts[key] ?? 0) + 1;
        }
      }
    }

    return res.json({
      data: {
        total_corrections: totalDrafts?.count ?? 0,
        most_corrected_fields: Object.entries(fieldCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([field, count]) => ({ field, count })),
      },
    });
  } catch (error: unknown) {
    console.error('[GET /api/v1/admin/inbox/metrics]', error);
    return res.status(500).json({ error: 'Erro ao carregar métricas.' });
  }
});

export default router;
