import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { importDiscordChatExporterJson, extractJsonPayload, parseUploadedJsonBuffer } from '../../discord/chatExporterImportService';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { db } from '../../db';
import { validateReparseMessageIds, buildContentIndex, reparseOneMessage, recordImportRun } from './utils';
import { uploadJsonFile } from './preview';

const router = Router();

// DEB-048-21: helper compartilhado de resposta de erro
function respondImportError(res: Response, error: unknown): void {
  if (error instanceof DiscordChatExporterValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  console.error('[import-json]', error instanceof Error ? error.message : 'unknown error');
  res.status(500).json({ error: 'Erro ao processar JSON do DiscordChatExporter.' });
}

// REV-016: helper de sucesso (DRY — elimina duplicação entre POST / e POST /file)
function respondImportSuccess(
  res: Response,
  result: { total: number; inserted: number; updated: number; ignored: number; failed: number },
  userId: string | undefined,
  autoParse?: { total: number; parsed: number; discarded: number; ignored: number; errors: number },
): void {
  recordImportRun({
    sourceKind: 'discord_chat_exporter_json' as const,
    totalMessages: result.total,
    draftsCreated: result.inserted,
    draftsUpdated: result.updated,
    messagesIgnored: result.ignored,
    messagesFailed: result.failed,
    userId,
  }).catch(() => {});
  res.json({
    data: {
      total: result.total,
      inserted: result.inserted,
      updated: result.updated,
      ignored: result.ignored,
      failed: result.failed,
      auto_parse: autoParse ?? null,
    },
  });
}

function shouldAutoParse(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const value = (raw as Record<string, unknown>).autoParse;
  if (value === true) return true;
  return typeof value === 'string' && ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

async function autoParsePendingImportedMessages(
  userId: string | undefined,
  importedMessages: { channelId: string; messageId: string }[] | undefined,
): Promise<{ total: number; parsed: number; discarded: number; ignored: number; errors: number }> {
  if (!importedMessages?.length) {
    return { total: 0, parsed: 0, discarded: 0, ignored: 0, errors: 0 };
  }

  const messages = await db
    .selectFrom('discord_import_messages')
    .selectAll()
    .where('source_kind', '=', 'discord_chat_exporter_json')
    .where('status', '=', 'pending')
    .where((eb) => eb.or(importedMessages.map((message) => eb.and([
      eb('discord_channel_id', '=', message.channelId),
      eb('discord_message_id', '=', message.messageId),
    ]))))
    .limit(500)
    .execute();

  const contentIndex = buildContentIndex(messages);
  let parsed = 0;
  let discarded = 0;
  let ignored = 0;
  let errors = 0;

  for (const message of messages) {
    const outcome = await reparseOneMessage(message, contentIndex, userId);
    if (outcome === 'error') errors++;
    else if (outcome === 'discarded') discarded++;
    else if (outcome === 'ignored') ignored++;
    else if (outcome !== 'skipped') parsed++;
  }

  return { total: messages.length, parsed, discarded, ignored, errors };
}

router.post('/', requireAdmin, async (req: Request, res: Response) => {

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const autoParse = shouldAutoParse(req.body);
    const result = await importDiscordChatExporterJson(extracted.payload);
    const autoParseResult = autoParse ? await autoParsePendingImportedMessages(req.user?.userId, result.importedMessages) : undefined;

    return respondImportSuccess(res, result, req.user?.userId, autoParseResult);
  } catch (error: unknown) {
    respondImportError(res, error);
  }
});

// POST /import-json/file — import de arquivo JSON (sem texto no body)
router.post('/file', requireAdmin, uploadJsonFile, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const parsed = parseUploadedJsonBuffer(req.file);
    if ('error' in parsed) return res.status(parsed.status).json({ error: parsed.error });

    const autoParse = shouldAutoParse(req.body);
    const result = await importDiscordChatExporterJson(parsed.parsed);
    const autoParseResult = autoParse ? await autoParsePendingImportedMessages(req.user?.userId, result.importedMessages) : undefined;

    return respondImportSuccess(res, result, req.user?.userId, autoParseResult);
  } catch (error: unknown) {
    // Erros do multer (LIMIT_FILE_SIZE / fileFilter) já são tratados em uploadJsonFile.
    respondImportError(res, error);
  }
});

// POST /import-json/reparse — reprocessa mensagens DiscordChatExporter pendentes
router.post('/reparse', requireAdmin, async (req: Request, res: Response) => {
  try {
    // DEB-048-19: validação de messageIds (payload externo) — lança → 400.
    const messageIds = validateReparseMessageIds(req.body?.messageIds);
    const hasIds = !!messageIds?.length;

    // DEB-048-17: lista de status condicional numa ÚNICA cláusula (múltiplos
    // .where('status',...) seriam ANDeados pelo Kysely e excluiriam 'parsed').
    let query = db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('source_kind', '=', 'discord_chat_exporter_json')
      .where('status', 'in', hasIds
        ? ['pending', 'needs_review', 'parsed']
        : ['pending', 'needs_review']);

    if (hasIds) {
      query = query.where('discord_message_id', 'in', messageIds);
    }

    const messages = await query.limit(500).execute();

    if (messages.length === 0) {
      return res.json({ data: { total: 0, reparsed: 0, discarded: 0, ignored: 0, errors: 0 } });
    }

    const contentIndex = buildContentIndex(messages);
    let reparsed = 0;
    let discarded = 0; // DEB-048-27: descartados por autoria (homebrew)
    let ignored = 0;
    let errors = 0;

    for (const message of messages) {
      // DEB-048-22/20: processamento + política de erro por mensagem no helper.
      const outcome = await reparseOneMessage(message, contentIndex, req.user?.userId);
      if (outcome === 'error') errors++;
      else if (outcome === 'discarded') discarded++; // DEB-048-27
      else if (outcome === 'ignored') ignored++;
      else if (outcome !== 'skipped') reparsed++; // 'parsed' ou 'reconciled'
    }

    return res.json({
      data: {
        total: messages.length,
        reparsed,
        discarded,
        ignored,
        errors,
      },
    });
  } catch (error: unknown) {
    respondImportError(res, error);
  }
});

export default router;
