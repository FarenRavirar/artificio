import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAdmin } from '../../middleware/auth';
import { importDiscordChatExporterJson, extractJsonPayload, MAX_IMPORT_JSON_BYTES } from '../../discord/chatExporterImportService';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { db } from '../../db';
import { validateReparseMessageIds, buildContentIndex, reparseOneMessage, recordImportRun } from './utils';
import { jsonFileUpload } from './preview';

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

router.post('/', requireAdmin, async (req: Request, res: Response) => {

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const result = await importDiscordChatExporterJson(extracted.payload);

    // T-G6: registra métricas da rodada (best-effort)
    recordImportRun({
      sourceKind: 'discord_chat_exporter_json',
      totalMessages: result.total,
      draftsCreated: result.inserted,
      draftsUpdated: result.updated,
      messagesIgnored: result.ignored,
      messagesFailed: result.failed,
      userId: (req as any).user?.userId,
    }).catch(() => {});

    return res.json({
      data: {
        total: result.total,
        inserted: result.inserted,
        updated: result.updated,
        ignored: result.ignored,
        failed: result.failed,
      },
    });
  } catch (error: unknown) {
    respondImportError(res, error);
  }
});

// POST /import-json/file — import de arquivo JSON (sem texto no body)
router.post('/file', requireAdmin, jsonFileUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const rawJson = req.file.buffer.toString('utf-8');

    if (rawJson.length > MAX_IMPORT_JSON_BYTES) {
      return res.status(413).json({ error: `JSON muito grande (${(rawJson.length / 1024 / 1024).toFixed(1)} MB). O limite é ${MAX_IMPORT_JSON_BYTES / 1024 / 1024} MB.` });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return res.status(400).json({ error: 'JSON inválido: o arquivo não contém JSON válido.' });
    }

    const result = await importDiscordChatExporterJson(parsed);

    recordImportRun({
      sourceKind: 'discord_chat_exporter_json',
      totalMessages: result.total,
      draftsCreated: result.inserted,
      draftsUpdated: result.updated,
      messagesIgnored: result.ignored,
      messagesFailed: result.failed,
      userId: (req as any).user?.userId,
    }).catch(() => {});

    return res.json({
      data: {
        total: result.total,
        inserted: result.inserted,
        updated: result.updated,
        ignored: result.ignored,
        failed: result.failed,
      },
    });
  } catch (error: unknown) {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `Arquivo muito grande. O limite é ${MAX_IMPORT_JSON_BYTES / 1024 / 1024} MB.` });
      }
      return res.status(400).json({ error: 'Erro ao processar arquivo.' });
    }
    if (error instanceof Error && error.message === 'Formato inválido. Envie apenas arquivos .json.') {
      return res.status(400).json({ error: error.message });
    }
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
