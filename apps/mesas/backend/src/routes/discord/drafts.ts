import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import type { DiscordImportDraftStatus } from '../../discord';
import { normalizeDraftPayload, refreshDiscordDraftImage } from '../../discord';
import { getAiAutomationConfig } from '../../discord/aiAutomationConfig';
import { auditDiscordDraftCompleteness } from '../../discord/llmAssist';
import { extractDraftScope, recordParseFeedback } from '../../discord/parseLearning';
import { stripSeparatorLines } from '../../discord/parseDiscordAnnouncement';
import { destroyAssetResult } from '@artificio/media';
import { parseDiscordMessage, ensureSystemSuggestionForDraft, handlePatchDraft } from './utils';

const router = Router();

// Batch: status em lote (ex.: rejeitar selecionados). 'rejected'/'needs_review'/'draft'
// são transições seguras; 'ready'/'synced' não entram (têm regras/efeitos próprios).
const batchDraftSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(['draft', 'needs_review', 'rejected']),
});

async function loadDraftContentRaw(draft: { discord_message_id: string | null; import_message_id?: string | null }): Promise<string | null> {
  if (draft.discord_message_id) {
    const message = await db
      .selectFrom('discord_import_messages')
      .select(['content_raw'])
      .where('id', '=', draft.discord_message_id)
      .executeTakeFirst();
    return message?.content_raw ? stripSeparatorLines(message.content_raw) : null;
  }
  if (draft.import_message_id) {
    const message = await db
      .selectFrom('import_messages')
      .select(['raw_text'])
      .where('id', '=', draft.import_message_id)
      .executeTakeFirst();
    return message?.raw_text ? stripSeparatorLines(message.raw_text) : null;
  }
  return null;
}

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

    // Fase I (spec 058): content_raw da mensagem original, pro preview lado a lado
    // no editor — nunca perdido mesmo quando campos estruturados falham no parse.
    const contentRaw: string | null = await loadDraftContentRaw(draft);

    return res.json({ data: { ...draft, content_raw: contentRaw } });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar draft.' });
  }
});

type AuditRunResult =
  | { ok: true; data: { candidates: Array<{ field: string; value?: unknown; evidence: string; confidence?: number; issue_type?: 'missing' | 'incorrect' }> } }
  | { ok: false; status: number; error: string };

// Extraído de audit-completeness (endpoint geral) pra reuso em audit-field
// (endpoint por-campo, pedido do mantenedor 2026-07-07 — botão pequeno ao
// lado de cada input, tipo o badge "Parser", que reanalisa só aquele campo).
async function runCompletenessAudit(draftId: string): Promise<AuditRunResult> {
  const aiConfig = getAiAutomationConfig();
  // T10.9 (spec 058): auditoria de completude e acao manual sob demanda —
  // nao depende do modo automatico (suggest/shadow/auto/off), so do kill
  // switch real. Gatear por isAiAssistEnabled() (que bloqueia mode='off')
  // desligava a feature justamente no estado padrao de producao
  // (MESAS_AI_AUTOMATION_MODE nunca setada), achado CodeRabbit na PR #128.
  if (aiConfig.killSwitch) {
    return { ok: false, status: 423, error: 'Assistente IA desligado.' };
  }

  const draft = await db
    .selectFrom('discord_import_table_drafts')
    .selectAll()
    .where('id', '=', draftId)
    .executeTakeFirst();
  if (!draft) return { ok: false, status: 404, error: 'Draft não encontrado.' };

  const contentRaw = await loadDraftContentRaw(draft);
  if (!contentRaw) return { ok: false, status: 422, error: 'Texto original indisponível para auditoria.' };

  const payload = normalizeDraftPayload(draft.normalized_payload ?? draft.parsed_payload);
  const table = payload.table && typeof payload.table === 'object' && !Array.isArray(payload.table)
    ? payload.table as Record<string, unknown>
    : {};
  // Achado CodeRabbit (PR #128): contact_discord/host_discord_id sao
  // identificador de usuario Discord — nao vai pro DeepSeek (provider
  // terceiro). Auditoria de completude so precisa dos campos de conteudo.
  const { contact_discord, host_discord_id, ...contentFields } = table;
  const result = await auditDiscordDraftCompleteness({
    rawText: contentRaw,
    currentFields: contentFields,
    model: aiConfig.model,
  });
  if (!result) return { ok: false, status: 502, error: 'Auditoria DeepSeek indisponível.' };

  // Achado do mantenedor (2026-07-07): contact_discord/host_discord_id nunca
  // vao pro DeepSeek (linha acima), entao a IA nunca pode reportar contato
  // faltando — mesmo furo que fez a auditoria "nao achar lacuna" com um
  // draft sem nenhum canal de contato. Checagem local (sem LLM) cobre esse
  // campo especifico, que fica de fora por design de privacidade.
  // Achado Codex (PR #131): contact_url NAO e excluido do payload (vai pro
  // DeepSeek normalmente) — draft com so link de inscricao (Forms/MesaQuest)
  // e sem Discord tem contato valido; sem checar contact_url aqui, a
  // checagem local injetava candidate falso mesmo com contato satisfeito.
  const contactUrl = table.contact_url;
  const hasContact = Boolean(
    (typeof contact_discord === 'string' && contact_discord.trim())
    || (typeof host_discord_id === 'string' && host_discord_id.trim())
    || (typeof contactUrl === 'string' && contactUrl.trim())
  );
  const candidates = hasContact
    ? result.candidates
    : [
        ...result.candidates,
        {
          field: 'contact_discord',
          evidence: 'Nenhum canal de contato (link/menção/autor) encontrado no anúncio.',
          issue_type: 'missing' as const,
        },
      ];

  return { ok: true, data: { ...result, candidates } };
}

router.post('/:id/audit-completeness', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await runCompletenessAudit(req.params.id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json({ data: result.data });
  } catch (error: unknown) {
    console.error('[POST /admin/discord/drafts/:id/audit-completeness]', error);
    return res.status(500).json({ error: 'Erro ao auditar completude do draft.' });
  }
});

// Botão pequeno por campo (pedido do mantenedor 2026-07-07): reaudita só o
// campo indicado, ao lado do badge "Parser" no editor. Reusa a mesma
// auditoria completa (mesmo custo de chamada DeepSeek) e filtra o resultado
// pro campo pedido — não há prompt/endpoint separado por campo porque o
// modelo já compara texto bruto x TODOS os campos numa chamada só.
router.post('/:id/audit-field/:field', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await runCompletenessAudit(req.params.id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    const candidates = result.data.candidates.filter((c) => c.field === req.params.field);
    return res.json({ data: { candidates } });
  } catch (error: unknown) {
    console.error('[POST /admin/discord/drafts/:id/audit-field/:field]', error);
    return res.status(500).json({ error: 'Erro ao auditar campo do draft.' });
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

    if (parsed.data.status === 'rejected') {
      for (const draft of drafts) {
        const payload = normalizeDraftPayload(draft.normalized_payload ?? draft.parsed_payload);
        await recordParseFeedback({
          draftId: draft.id,
          feedbackType: 'discard',
          beforeValue: 'draft',
          afterValue: 'rejected',
          reason: 'batch',
          scope: extractDraftScope(payload),
          adminUserId: req.user?.userId ?? null,
        });
      }
    }

    return res.json({ data: { updated: drafts.length, drafts } });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/drafts/batch]', error);
    return res.status(500).json({ error: 'Erro ao atualizar drafts em lote.' });
  }
});

// ─── DELETE /rejected ───────────────────────────────────────────────────────────
// Apaga DEFINITIVAMENTE todos os drafts descartados (status='rejected'). Limpeza da
// fila de moderação. Registrado ANTES de /:id (literal vence param). Intent-locked:
// só remove 'rejected' — nunca draft/ready/needs_review/synced. FKs filhas
// (import_corrections, discord_shadow_decisions) têm ON DELETE CASCADE → remoção
// limpa, sem migration. origin opcional espelha o filtro da listagem.
const purgeRejectedSchema = z.object({
  origin: z.enum(['discord', 'inbox', 'all']).default('all'),
});

router.delete('/rejected', requireAdmin, async (req: Request, res: Response) => {
  const parsed = purgeRejectedSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    // Coleta os descartados-alvo (id + capa) ANTES de apagar. Capa no Cloudinary
    // precisa ser destruída primeiro — apagar a linha some o ponteiro
    // cover_public_id e o asset vira órfão eterno (o cronRunner
    // cleanupOrphanDraftImages só varre 'draft'/'needs_review', nunca 'rejected').
    let targetQuery = db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'cover_public_id'])
      .where('status', '=', 'rejected');

    if (parsed.data.origin === 'inbox') {
      targetQuery = targetQuery.where('import_message_id', 'is not', null);
    } else if (parsed.data.origin === 'discord') {
      targetQuery = targetQuery.where('discord_message_id', 'is not', null);
    }
    // 'all' → sem filtro de origem (remove descartados de ambas as origens)

    const targets = await targetQuery.execute();

    // Apagáveis: sem capa, ou cuja capa foi destruída com sucesso. Capa que falhou
    // ao destruir mantém a linha (retry numa próxima limpeza evita vazar mídia).
    const deletableIds: string[] = [];
    let coverDestroyFailed = 0;
    for (const target of targets) {
      if (!target.cover_public_id) {
        deletableIds.push(target.id);
        continue;
      }
      const ok = await destroyAssetResult(target.cover_public_id);
      if (ok) {
        deletableIds.push(target.id);
      } else {
        coverDestroyFailed++;
        console.warn(`[DELETE /admin/discord/drafts/rejected] destroy de capa falhou para draft ${target.id} — linha preservada p/ retry.`);
      }
    }

    if (deletableIds.length === 0) {
      return res.json({ data: { deleted: 0, cover_destroy_failed: coverDestroyFailed } });
    }

    // Guarda 'status' = 'rejected' contra corrida (linha pode ter mudado entre
    // o select e o delete).
    const result = await db
      .deleteFrom('discord_import_table_drafts')
      .where('id', 'in', deletableIds)
      .where('status', '=', 'rejected')
      .executeTakeFirst();
    const deleted = Number(result?.numDeletedRows ?? 0);
    return res.json({ data: { deleted, cover_destroy_failed: coverDestroyFailed } });
  } catch (error: unknown) {
    console.error('[DELETE /admin/discord/drafts/rejected]', error);
    return res.status(500).json({ error: 'Erro ao limpar drafts descartados.' });
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
