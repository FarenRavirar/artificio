import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import type { DiscordImportMessageStatus } from '../../discord';
import { DiscordIngestError } from '../../discord';
import { requireDiscordBotToken } from '../../discord/config';
import { sendDiscordFetchError } from './utils';

const router = Router();
const DISCORD_API_BASE = 'https://discord.com/api/v10';

const updateMessageSchema = z.object({
  status: z.enum(['pending', 'parsed', 'needs_review', 'synced', 'ignored', 'error']),
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
    console.error('[GET /admin/discord-sync/messages]', error);
    return res.status(500).json({ error: 'Erro ao listar mensagens.' });
  }
});

// ─── PATCH /messages/:id
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
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
    console.error('[PATCH /admin/discord-sync/messages/:id]', error);
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
