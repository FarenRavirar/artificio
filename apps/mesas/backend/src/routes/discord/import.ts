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
    },
  });
}

router.post('/', requireAdmin, async (req: Request, res: Response) => {

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const result = await importDiscordChatExporterJson(extracted.payload);

    return respondImportSuccess(res, result, (req as any).user?.userId);
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

    const result = await importDiscordChatExporterJson(parsed.parsed);

    return respondImportSuccess(res, result, (req as any).user?.userId);
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
