import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import type { DiscordImportDraftStatus } from '../../discord';
import { refreshDiscordDraftImage } from '../../discord';
import { parseDiscordMessage, ensureSystemSuggestionForDraft, handlePatchDraft } from './utils';

const router = Router();

// Batch: status em lote (ex.: rejeitar selecionados). 'rejected'/'needs_review'/'draft'
// são transições seguras; 'ready'/'synced' não entram (têm regras/efeitos próprios).
const batchDraftSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(['draft', 'needs_review', 'rejected']),
});

// Schemas compartilhados: patchDraftSchema via handlePatchDraft (REV-074)

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0', origin } = req.query as Record<string, string>;

    let query = db
      .selectFrom('discord_import_table_drafts')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(Math.min(Number(limit) || 50, 100))
      .offset(Number(offset) || 0);

    // WS2: filtro por origem. 'discord' (default) = só Discord; 'inbox' = só inbox;
    // 'all' = ambos. Ausente → comportamento legado (só Discord).
    if (origin === 'inbox') {
      query = query.where('import_message_id', 'is not', null);
    } else if (origin === 'all') {
      // sem filtro extra — retorna ambos
    } else {
      // default / legado: só Discord
      query = query.where('discord_message_id', 'is not', null);
    }

    const validDraftStatuses: DiscordImportDraftStatus[] = ['draft', 'ready', 'needs_review', 'synced', 'rejected'];
    if (status && validDraftStatuses.includes(status as DiscordImportDraftStatus)) {
      query = query.where('status', '=', status as DiscordImportDraftStatus);
    }

    const drafts = await query.execute();
    return res.json({ data: drafts });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/drafts]', error);
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
    console.error('[GET /admin/discord/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar draft.' });
  }
});

// ─── PATCH /batch ─────────────────────────────────────────────────────────────
// Atualiza status de vários drafts (ex.: rejeitar selecionados). Registrado ANTES
// de /:id para a rota literal vencer o param. Não rejeita drafts já sincronizados.
router.patch('/batch', requireAdmin, async (req: Request, res: Response) => {
  const parsed = batchDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    // Codex P2 (T-G7) + CodeRabbit: atualizar drafts e fechar o outcome shadow na
    // MESMA transação — se o fechamento shadow falhar, faz rollback do lote inteiro
    // (evita actual_outcome inconsistente com o status real).
    const drafts = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('discord_import_table_drafts')
        .set({ status: parsed.data.status, updated_at: new Date() })
        .where('id', 'in', parsed.data.ids)
        .where('status', '!=', 'synced')
        .returningAll()
        .execute();

      if (parsed.data.status === 'rejected' && updated.length > 0) {
        await trx
          .updateTable('discord_shadow_decisions')
          .set({ actual_outcome: 'rejected', actual_at: new Date() })
          .where('draft_id', 'in', updated.map((d) => d.id))
          .where('actual_outcome', 'is', null)
          .execute();
      }

      return updated;
    });

    return res.json({ data: { updated: drafts.length, drafts } });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/drafts/batch]', error);
    return res.status(500).json({ error: 'Erro ao atualizar drafts em lote.' });
  }
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await handlePatchDraft(req, {
      transformData: (data, current) => {
        const mergedNormalizedPayload = data.normalized_payload
          ? { ...(current.normalized_payload as Record<string, unknown>), ...(data.normalized_payload as Record<string, unknown>) }
          : undefined;
        return {
          ...data,
          ...(mergedNormalizedPayload === undefined ? {} : { normalized_payload: mergedNormalizedPayload }),
        };
      },
    });
    return res.status(result.status).json(result.body);
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/drafts/:id]', error);
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
    console.error('[POST /admin/discord/drafts/:id/refresh-image]', error);
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

    const result = await parseDiscordMessage(message);
    if (!result) return res.status(422).json({ error: 'Mensagem sem conteudo elegivel para virar draft.' });
    const { parsed, normalized } = result;

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
    console.error('[POST /admin/discord/drafts/:id/reparse]', error);
    return res.status(500).json({ error: 'Erro ao reparsar draft.' });
  }
});

export default router;
