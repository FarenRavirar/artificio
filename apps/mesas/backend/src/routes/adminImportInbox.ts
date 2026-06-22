import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import type { SystemEntry } from '../discord';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft } from '../discord';
import { authMiddleware } from '../middleware/auth';
import { textToRawMessage } from '../inbox/adapters/textToRawMessage';
import { segmentAnnouncements } from '../inbox/segmentation';
import { syncImportDraftToTable, DraftSyncValidationError } from '../inbox/syncImportDraftToTable';

const router = Router();

function isAdmin(req: Request, res: Response): boolean {
  if ((req as any).user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return false;
  }
  return true;
}

async function loadSystemsForParser(): Promise<SystemEntry[]> {
  const systems = await db
    .selectFrom('systems')
    .select(['id', 'name', 'name_pt'])
    .execute();

  const aliases = await db
    .selectFrom('system_aliases')
    .select(['system_id', 'alias'])
    .execute();

  const aliasMap = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.system_id) ?? [];
    list.push(a.alias);
    aliasMap.set(a.system_id, list);
  }

  return systems.map((s) => ({
    id: s.id,
    name: s.name,
    name_pt: s.name_pt,
    aliases: aliasMap.get(s.id) ?? [],
  }));
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const importTextSchema = z.object({
  text: z.string().min(10, 'Texto muito curto para segmentação (mínimo 10 caracteres).'),
  title_hint: z.string().optional(),
});

const listDraftsSchema = z.object({
  status: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  origin: z.string().optional(),
});

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

      const [importMessage] = await db
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

      const rawMessage = textToRawMessage(segment, title_hint);
      const parsedDraft = parseDiscordAnnouncement(rawMessage, systems);

      if (!parsedDraft) {
        await db
          .updateTable('import_messages')
          .set({ status: 'error', parse_error: 'Mensagem sem conteúdo elegível para virar draft.' })
          .where('id', '=', importMessage.id)
          .execute();
        continue;
      }

      const normalized = normalizeDiscordTableDraft(parsedDraft, systems);

      const [draftRow] = await db
        .insertInto('discord_import_table_drafts')
        .values({
          discord_message_id: null,
          import_message_id: importMessage.id,
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
        .where('id', '=', importMessage.id)
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
        confidence: draftRow.confidence,
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
      const payload = row.normalized_payload as Record<string, unknown> | null;
      const table = (payload?.table ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        source_type: row.source_type,
        raw_text: row.raw_text,
        status: row.status,
        confidence: row.confidence,
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
    if (error instanceof DraftSyncValidationError) {
      return res.status(422).json({ error: error.message, missing_fields: error.missingFields });
    }
    console.error('[POST /api/v1/admin/inbox/drafts/:id/sync]', error);
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar draft.';
    return res.status(500).json({ error: message });
  }
});

// ─── POST /drafts/:id/correction ──────────────────────────────────────────────

const correctionSchema = z.object({
  corrections: z.record(z.string(), z.unknown()),
  reason: z.string().optional(),
});

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

    const { corrections, reason } = parsed.data;

    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .select(['parsed_payload', 'normalized_payload', 'import_message_id'])
      .where('id', '=', draftId)
      .executeTakeFirst();

    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });

    const parsedBefore = draft.normalized_payload ?? draft.parsed_payload;
    const humanCorrected = { ...(parsedBefore as Record<string, unknown>), table: { ...((parsedBefore as Record<string, unknown>)?.table ?? {}), ...corrections } };

    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(corrections)) {
      const before = ((parsedBefore as Record<string, unknown>)?.table as Record<string, unknown>)?.[key];
      const after = corrections[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        diff[key] = { before, after };
      }
    }

    const userId = (req as any).user?.userId ?? null;

    await db
      .insertInto('import_corrections')
      .values({
        draft_id: draftId,
        import_message_id: draft.import_message_id,
        raw_text: null,
        parsed_before: parsedBefore,
        human_corrected: humanCorrected,
        diff,
        reason: reason ?? null,
        corrected_by: userId,
      })
      .execute();

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
