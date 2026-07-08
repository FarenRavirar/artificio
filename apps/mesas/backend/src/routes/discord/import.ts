import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { importDiscordChatExporterJson, extractJsonPayload, parseUploadedJsonBuffer } from '../../discord/chatExporterImportService';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { db } from '../../db';
import { validateReparseMessageIds, buildContentIndex, reparseOneMessage, recordImportRun } from './utils';
import { uploadJsonFile } from './preview';
import { loadCommunicationPlatformsForParser, loadScenariosForParser, loadSystemsForParser, loadVttPlatformsForParser } from '../../discord/shared';

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
  truncationWarning?: string,
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
      warning: truncationWarning ?? null,
    },
  });
}

function shouldAutoParse(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const value = (raw as Record<string, unknown>).autoParse;
  if (value === true) return true;
  return typeof value === 'string' && ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

// DEB-058-XX: filtro funcional de mesa paga na UI de import. Default `true`
// (aceita pagas) se o campo não vier — só existe controle explícito quando o
// cliente manda `acceptPaidTables`. String/boolean por vir de JSON body ou
// FormData (multipart não tem tipo boolean nativo).
function readAcceptPaidTables(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return true;
  const value = (raw as Record<string, unknown>).acceptPaidTables;
  if (value === undefined || value === null) return true;
  if (value === false) return false;
  if (value === true) return true;
  return !(typeof value === 'string' && ['false', '0', 'no', 'off'].includes(value.trim().toLowerCase()));
}

// Achado do mantenedor 2026-07-08: filtro "só com contato explícito" movido
// da tela de revisão (ocultação visual pós-import) pra opção real de import —
// mesma forma do readAcceptPaidTables acima. Default `false` (não filtra,
// comportamento anterior preservado) se o campo não vier.
function readRequireExplicitContact(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const value = (raw as Record<string, unknown>).requireExplicitContact;
  if (value === true) return true;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

// DEB-058-XX: o import aceita até 2000 mensagens/lote (chatExporterImportService),
// mas o auto-parse só processava as primeiras 500 (limit da query) e reportava
// auto_parse.total como se fosse o universo inteiro — o resto ficava pending sem
// nova rodada automática. Agora processa importedMessages em lotes de 500,
// somando os totais de todos os lotes.
const AUTO_PARSE_BATCH_SIZE = 500;

async function autoParsePendingImportedMessages(
  userId: string | undefined,
  importedMessages: { channelId: string; messageId: string }[] | undefined,
  acceptPaidTables = true,
  requireExplicitContact = false,
): Promise<{ total: number; parsed: number; discarded: number; ignored: number; errors: number }> {
  if (!importedMessages?.length) {
    return { total: 0, parsed: 0, discarded: 0, ignored: 0, errors: 0 };
  }

  let total = 0;
  let parsed = 0;
  let discarded = 0;
  let ignored = 0;
  let errors = 0;

  // Catálogos carregados uma vez fora do loop de batches — não mudam entre
  // iterações da mesma requisição, recarregar por batch é N+1 evitável.
  const [systems, vttPlatforms, communicationPlatforms, scenarios] = await Promise.all([
    loadSystemsForParser(),
    loadVttPlatformsForParser(),
    loadCommunicationPlatformsForParser(),
    loadScenariosForParser(),
  ]);

  for (let offset = 0; offset < importedMessages.length; offset += AUTO_PARSE_BATCH_SIZE) {
    const batch = importedMessages.slice(offset, offset + AUTO_PARSE_BATCH_SIZE);

    const messages = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('source_kind', '=', 'discord_chat_exporter_json')
      .where('status', '=', 'pending')
      .where((eb) => eb.or(batch.map((message) => eb.and([
        eb('discord_channel_id', '=', message.channelId),
        eb('discord_message_id', '=', message.messageId),
      ]))))
      .limit(AUTO_PARSE_BATCH_SIZE)
      .execute();

    const contentIndex = buildContentIndex(messages);
    total += messages.length;

    for (const message of messages) {
      const outcome = await reparseOneMessage(message, contentIndex, userId, acceptPaidTables, systems, {
        vttPlatforms,
        communicationPlatforms,
        scenarios,
      }, requireExplicitContact);
      if (outcome === 'error') errors++;
      else if (outcome === 'discarded') discarded++;
      else if (outcome === 'ignored') ignored++;
      else if (outcome !== 'skipped') parsed++;
    }
  }

  return { total, parsed, discarded, ignored, errors };
}

router.post('/', requireAdmin, async (req: Request, res: Response) => {

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const autoParse = shouldAutoParse(req.body);
    const acceptPaidTables = readAcceptPaidTables(req.body);
    const requireExplicitContact = readRequireExplicitContact(req.body);
    const result = await importDiscordChatExporterJson(extracted.payload);
    const autoParseResult = autoParse ? await autoParsePendingImportedMessages(req.user?.userId, result.importedMessages, acceptPaidTables, requireExplicitContact) : undefined;

    return respondImportSuccess(res, result, req.user?.userId, autoParseResult, extracted.truncationWarning);
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
    const acceptPaidTables = readAcceptPaidTables(req.body);
    const requireExplicitContact = readRequireExplicitContact(req.body);
    const result = await importDiscordChatExporterJson(parsed.parsed);
    const autoParseResult = autoParse ? await autoParsePendingImportedMessages(req.user?.userId, result.importedMessages, acceptPaidTables, requireExplicitContact) : undefined;

    return respondImportSuccess(res, result, req.user?.userId, autoParseResult, parsed.truncationWarning);
  } catch (error: unknown) {
    // Erros do multer (LIMIT_FILE_SIZE / fileFilter) já são tratados em uploadJsonFile.
    respondImportError(res, error);
  }
});

// POST /import-json/reparse — reprocessa mensagens DiscordChatExporter pendentes
// DEB-058-XX: mesmo bug do auto-parse — filtro por status sem messageIds pode
// casar mais de 500 pendentes e o .limit(500) truncava calado, sem nova rodada.
// Agora repete a query em lotes (o próprio reparse tira as linhas processadas
// do filtro de status, então cada iteração naturalmente pega o próximo lote)
// até esgotar ou bater um teto de segurança contra loop infinito.
const REPARSE_BATCH_SIZE = 500;
const REPARSE_MAX_BATCHES = 20; // teto de segurança: até 10k mensagens por chamada

router.post('/reparse', requireAdmin, async (req: Request, res: Response) => {
  try {
    // DEB-048-19: validação de messageIds (payload externo) — lança → 400.
    const messageIds = validateReparseMessageIds(req.body?.messageIds);
    const hasIds = !!messageIds?.length;
    const acceptPaidTables = readAcceptPaidTables(req.body);
    const requireExplicitContact = readRequireExplicitContact(req.body);

    let total = 0;
    let reparsed = 0;
    let discarded = 0; // DEB-048-27: descartados por autoria (homebrew)
    let ignored = 0;
    let errors = 0;
    let truncated = false;

    // hasIds: conjunto já é bounded pelos ids recebidos — fatia em chunks de
    // REPARSE_BATCH_SIZE (cada chunk vira sua própria query `in`, não trunca).
    // Sem ids: universo é todo pendente/needs_review — repete a MESMA query em
    // lotes (cada mensagem processada sai do filtro de status, então a próxima
    // iteração naturalmente pega o próximo lote) até esgotar ou bater o teto.
    const idChunks = hasIds
      ? Array.from(
        { length: Math.ceil(messageIds!.length / REPARSE_BATCH_SIZE) },
        (_, i) => messageIds!.slice(i * REPARSE_BATCH_SIZE, (i + 1) * REPARSE_BATCH_SIZE),
      )
      : [undefined];

    // Catálogos carregados uma vez fora do loop de batches — não mudam entre
    // iterações da mesma requisição, recarregar por batch é N+1 evitável.
    const [systems, vttPlatforms, communicationPlatforms, scenarios] = await Promise.all([
      loadSystemsForParser(),
      loadVttPlatformsForParser(),
      loadCommunicationPlatformsForParser(),
      loadScenariosForParser(),
    ]);

    outer: for (const idChunk of idChunks) {
      for (let batchIndex = 0; batchIndex < REPARSE_MAX_BATCHES; batchIndex++) {
        // DEB-048-17: lista de status condicional numa ÚNICA cláusula (múltiplos
        // .where('status',...) seriam ANDeados pelo Kysely e excluiriam 'parsed').
        let query = db
          .selectFrom('discord_import_messages')
          .selectAll()
          .where('source_kind', '=', 'discord_chat_exporter_json')
          .where('status', 'in', idChunk
            ? ['pending', 'needs_review', 'parsed']
            : ['pending', 'needs_review']);

        if (idChunk) {
          query = query.where('discord_message_id', 'in', idChunk);
        }

        const messages = await query.limit(REPARSE_BATCH_SIZE).execute();
        if (messages.length === 0) break;

        const contentIndex = buildContentIndex(messages);
        total += messages.length;

        for (const message of messages) {
          // DEB-048-22/20: processamento + política de erro por mensagem no helper.
          const outcome = await reparseOneMessage(message, contentIndex, req.user?.userId, acceptPaidTables, systems, {
            vttPlatforms,
            communicationPlatforms,
            scenarios,
          }, requireExplicitContact);
          if (outcome === 'error') errors++;
          else if (outcome === 'discarded') discarded++; // DEB-048-27
          else if (outcome === 'ignored') ignored++;
          else if (outcome !== 'skipped') reparsed++; // 'parsed' ou 'reconciled'
        }

        // idChunk: já bounded ao próprio chunk, uma query resolve tudo.
        if (idChunk || messages.length < REPARSE_BATCH_SIZE) break;
        if (batchIndex === REPARSE_MAX_BATCHES - 1) {
          truncated = true;
          break outer;
        }
      }
    }

    return res.json({
      data: {
        total,
        reparsed,
        discarded,
        ignored,
        errors,
        truncated,
      },
    });
  } catch (error: unknown) {
    respondImportError(res, error);
  }
});

export default router;
