import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { requireAdmin } from '../../middleware/auth.js';
import type { DiscordImportMessageStatus } from '../../discord/index.js';
import { DiscordIngestError } from '../../discord/index.js';
import { requireDiscordBotToken } from '../../discord/config.js';
import { sendDiscordFetchError } from './utils.js';

const router = Router();
const DISCORD_API_BASE = 'https://discord.com/api/v10';

const updateMessageSchema = z.object({
  status: z.enum(['pending', 'parsed', 'needs_review', 'synced', 'ignored', 'error']),
});

const batchMessageSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(['pending', 'parsed', 'needs_review', 'synced', 'ignored', 'error']),
});

// Exclusão em lote é limitada aos MESMOS 200 ids do PATCH: o limite existe para
// o admin não apagar a fila inteira num clique acidental, e afrouxá-lo aqui — na
// operação irreversível — seria o inverso do razoável.
const deleteBatchMessageSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

const discordMessageDiagnosticSchema = z.object({
  id: z.string(),
  content: z.string().optional().default(''),
  attachments: z.array(z.unknown()).optional().default([]),
  embeds: z.array(z.unknown()).optional().default([]),
  message_reference: z.unknown().optional(),
  flags: z.number().optional(),
});

async function fetchDiscordMessageDiagnostic(channelId: string, messageId: string) {
  const token = (await requireDiscordBotToken()).trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
      { headers: { Authorization: `Bot ${token}` }, signal: controller.signal }
    );
    clearTimeout(timeout);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: unknown }).message)
        : 'Discord não respondeu como esperado.';
      throw new DiscordIngestError(message, response.status === 403 ? 403 : 502);
    }

    const parsed = discordMessageDiagnosticSchema.safeParse(payload);
    if (!parsed.success) {
      throw new DiscordIngestError('Discord retornou mensagem em formato inesperado.', 502);
    }

    return parsed.data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── GET /messages
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { source_id, status, limit = '50', offset = '0', since, until } = req.query as Record<string, string>;
    const sinceDate = since ? new Date(since) : null;
    const untilDate = until ? new Date(until) : null;

    if ((sinceDate && Number.isNaN(sinceDate.getTime())) || (untilDate && Number.isNaN(untilDate.getTime()))) {
      return res.status(400).json({ error: 'Janela de tempo inválida.' });
    }
    if (sinceDate && untilDate && sinceDate > untilDate) {
      return res.status(400).json({ error: 'Janela de tempo inválida.' });
    }

    let query = db
      .selectFrom('discord_import_messages')
      .selectAll()
      .orderBy('message_created_at', 'desc')
      .limit(Math.max(0, Math.min(Number(limit) || 50, 100)))
      .offset(Math.max(0, Number(offset) || 0));

    if (source_id) query = query.where('source_id', '=', source_id);
    if (sinceDate) query = query.where('message_created_at', '>=', sinceDate);
    if (untilDate) query = query.where('message_created_at', '<=', untilDate);
    const validMessageStatuses: DiscordImportMessageStatus[] = ['pending', 'parsed', 'needs_review', 'synced', 'ignored', 'error'];
    if (status && validMessageStatuses.includes(status as DiscordImportMessageStatus)) {
      query = query.where('status', '=', status as DiscordImportMessageStatus);
    }

    const messages = await query.execute();
    return res.json({ data: messages });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/messages]', error);
    return res.status(500).json({ error: 'Erro ao listar mensagens.' });
  }
});

// ─── PATCH /messages/batch — atualiza status de várias mensagens (ex.: ignorar selecionadas)
// Registrado ANTES de /:id para a rota literal vencer o param.
router.patch('/batch', requireAdmin, async (req: Request, res: Response) => {
  const parsed = batchMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    const messages = await db
      .updateTable('discord_import_messages')
      .set({ status: parsed.data.status, parse_error: null, updated_at: new Date() })
      .where('id', 'in', parsed.data.ids)
      .returningAll()
      .execute();
    return res.json({ data: { updated: messages.length, messages } });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/messages/batch]', error);
    return res.status(500).json({ error: 'Erro ao atualizar mensagens em lote.' });
  }
});

// ─── DELETE /messages/batch — apaga mensagens DEFINITIVAMENTE (spec 099)
// Registrado ANTES de /:id pelo mesmo motivo do PATCH /batch: rota literal vence o param.
//
// Existe porque o importador NÃO reabre mensagem que já conhece: o
// `ON CONFLICT ... DO UPDATE` de `chatExporterImportService.ts` só dispara
// quando o `content_hash` muda, então reimportar o mesmo JSON não devolve nada
// ao fluxo — a mensagem fica presa no status em que parou. Apagar é a única
// forma de reimportar o mesmo arquivo do zero.
//
// `discord_import_table_drafts.discord_message_id` é ON DELETE CASCADE
// (migration_115:64), então o draft vinculado vai junto — é o comportamento
// desejado, e por isso a contagem de drafts afetados volta na resposta. O
// aprendizado do parser (migration_136) é ON DELETE SET NULL: não se perde.
router.delete('/batch', requireAdmin, async (req: Request, res: Response) => {
  const parsed = deleteBatchMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    // Conta os drafts ANTES de apagar: depois do CASCADE não há como saber
    // quantos foram, e o admin precisa disso para conferir o que perdeu.
    const drafts = await db
      .selectFrom('discord_import_table_drafts')
      .select(({ fn }) => [fn.countAll<number>().as('total')])
      .where('discord_message_id', 'in', parsed.data.ids)
      .executeTakeFirst();

    const deleted = await db
      .deleteFrom('discord_import_messages')
      .where('id', 'in', parsed.data.ids)
      .returning(['id'])
      .execute();

    return res.json({
      data: { deleted: deleted.length, draftsRemoved: Number(drafts?.total ?? 0) },
    });
  } catch (error: unknown) {
    console.error('[DELETE /admin/discord/messages/batch]', error);
    return res.status(500).json({ error: 'Erro ao apagar mensagens.' });
  }
});

// ─── PATCH /messages/:id
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    const [message] = await db
      .updateTable('discord_import_messages')
      .set({ status: parsed.data.status, parse_error: null, updated_at: new Date() })
      .where('id', '=', req.params.id)
      .returningAll()
      .execute();
    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    return res.json({ data: message });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/messages/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar mensagem.' });
  }
});

// ─── POST /messages/:id/diagnose-content
router.post('/:id/diagnose-content', requireAdmin, async (req: Request, res: Response) => {
  try {
    const message = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });

    const apiMessage = await fetchDiscordMessageDiagnostic(message.discord_channel_id, message.discord_message_id);
    const apiContentLength = apiMessage.content.trim().length;
    const dbContentLength = message.content_raw.trim().length;
    const likelyMissingMessageContentIntent =
      apiContentLength === 0 &&
      dbContentLength === 0 &&
      Boolean(message.discord_thread_name) &&
      apiMessage.attachments.length === 0 &&
      apiMessage.embeds.length === 0;

    return res.json({
      data: {
        discord_message_id: message.discord_message_id,
        discord_channel_id: message.discord_channel_id,
        discord_thread_name: message.discord_thread_name,
        db_content_length: dbContentLength,
        api_content_length: apiContentLength,
        api_attachments_count: apiMessage.attachments.length,
        api_embeds_count: apiMessage.embeds.length,
        api_content_preview: apiMessage.content.trim().slice(0, 240),
        likely_missing_message_content_intent: likelyMissingMessageContentIntent,
        diagnosis: likelyMissingMessageContentIntent
          ? 'A API do Discord entregou o starter do tópico sem corpo, anexos ou embeds. O post existe, mas o bot não recebeu o conteúdo pela API; verifique o Message Content Intent no Developer Portal e permissões do canal/tópico.'
          : 'A API do Discord entregou algum conteúdo para esta mensagem.',
      },
    });
  } catch (error: unknown) {
    return sendDiscordFetchError(res, error);
  }
});

export default router;
