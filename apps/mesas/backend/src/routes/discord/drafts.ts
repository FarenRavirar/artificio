import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import type { DiscordImportDraftStatus } from '../../discord';
import { normalizeDiscordTableDraft, normalizeDraftPayload, refreshDiscordDraftImage, parseDiscordAnnouncement, assertDraftReadyTransition } from '../../discord';
import { parseJsonField, loadSystemsForParser, ensureSystemSuggestionForDraft } from './utils';

const router = Router();

const updateDraftTableSchema = z.object({
  type: z.enum(['campanha', 'one-shot', 'oneshot-serie', 'aberta']).nullable().optional(),
  modality: z.enum(['online', 'presencial', 'hibrida']).nullable().optional(),
  price_type: z.enum(['gratuita', 'paga']).nullable().optional(),
  frequency: z.enum(['semanal', 'quinzenal', 'mensal', 'avulsa']).nullable().optional(),
}).passthrough();

const updateDraftPayloadSchema = z.object({
  table: updateDraftTableSchema.optional(),
}).passthrough();

const updateDraftSchema = z.object({
  normalized_payload: updateDraftPayloadSchema.optional(),
  status: z.enum(['draft', 'ready', 'needs_review', 'rejected']).optional(),
  review_notes: z.string().optional(),
});

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query as Record<string, string>;

    let query = db
      .selectFrom('discord_import_table_drafts')
      .selectAll()
      .where('discord_message_id', 'is not', null)
      .orderBy('created_at', 'desc')
      .limit(Math.min(Number(limit) || 50, 100))
      .offset(Number(offset) || 0);

    const validDraftStatuses: DiscordImportDraftStatus[] = ['draft', 'ready', 'needs_review', 'synced', 'rejected'];
    if (status && validDraftStatuses.includes(status as DiscordImportDraftStatus)) {
      query = query.where('status', '=', status as DiscordImportDraftStatus);
    }

    const drafts = await query.execute();
    return res.json({ data: drafts });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/drafts]', error);
    return res.status(500).json({ error: 'Erro ao listar drafts.' });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    return res.json({ data: draft });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar draft.' });
  }
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
  }
  try {
    const current = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'normalized_payload'])
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!current) return res.status(404).json({ error: 'Draft não encontrado.' });

    const patchPayload = normalizeDraftPayload(parsed.data.normalized_payload) as { missing_fields?: unknown } | undefined;
    const currentPayload = normalizeDraftPayload(current.normalized_payload) as { missing_fields?: unknown } | null;
    const transition = assertDraftReadyTransition({
      patchStatus: parsed.data.status,
      patchPayloadMissing: patchPayload?.missing_fields,
      currentPayloadMissing: currentPayload?.missing_fields,
    });
    if (!transition.allowed) {
      return res.status(422).json({
        error: transition.reason ?? "Draft não pode ser marcado como 'ready'.",
        details: { missing_fields: transition.missingFields ?? [] },
      });
    }

    const mergedNormalizedPayload = parsed.data.normalized_payload
      ? { ...(current.normalized_payload as Record<string, unknown>), ...(parsed.data.normalized_payload as Record<string, unknown>) }
      : undefined;

    const [draft] = await db
      .updateTable('discord_import_table_drafts')
      .set({
        ...parsed.data,
        ...(mergedNormalizedPayload !== undefined ? { normalized_payload: mergedNormalizedPayload } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', req.params.id)
      .returningAll()
      .execute();
    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    return res.json({ data: draft });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord-sync/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar draft.' });
  }
});

// ─── POST /:id/refresh-image ──────────────────────────────────────────────────

router.post('/:id/refresh-image', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await refreshDiscordDraftImage(req.params.id);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao reenviar imagem.';
    console.error('[POST /admin/discord-sync/drafts/:id/refresh-image]', error);
    if (message.includes('não encontrado') || message.includes('sem payload')) {
      return res.status(422).json({ error: message });
    }
    return res.status(500).json({ error: 'Erro ao reenviar imagem.' });
  }
});

// ─── POST /:id/reparse ────────────────────────────────────────────────────────

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
    if (!draft.discord_message_id) {
      return res.status(422).json({ error: 'Draft de inbox não suporta reparse via Discord.' });
    }

    const message = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('id', '=', draft.discord_message_id)
      .executeTakeFirst();

    if (!message) return res.status(404).json({ error: 'Mensagem de origem não encontrada.' });

    const systems = await loadSystemsForParser();
    const parsed = parseDiscordAnnouncement({
      source_kind: message.source_kind,
      discord_message_id: message.discord_message_id,
      discord_channel_id: message.discord_channel_id,
      discord_guild_id: message.discord_guild_id,
      discord_parent_channel_id: message.discord_parent_channel_id,
      discord_thread_id: message.discord_thread_id,
      discord_thread_name: message.discord_thread_name,
      discord_author_id: message.discord_author_id,
      discord_author_name: message.discord_author_name,
      discord_message_url: message.discord_message_url,
      content_raw: message.content_raw,
      attachments: parseJsonField(message.attachments),
      embeds: parseJsonField(message.embeds),
      message_created_at: message.message_created_at,
      message_edited_at: message.message_edited_at,
    }, systems);
    if (!parsed) return res.status(422).json({ error: 'Mensagem sem conteudo elegivel para virar draft.' });
    const normalized = normalizeDiscordTableDraft(parsed, systems);

    const [updated] = await db
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

    await ensureSystemSuggestionForDraft(
      normalized.draft,
      req.user?.userId,
      message.discord_thread_name ?? message.discord_message_id,
    );

    return res.json({ data: updated });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/drafts/:id/reparse]', error);
    return res.status(500).json({ error: 'Erro ao reparsar draft.' });
  }
});

export default router;
