import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { importDiscordChatExporterJson, extractJsonPayload } from '../../discord/chatExporterImportService';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { db } from '../../db';
import { parseDiscordMessage, ensureSystemSuggestionForDraft, reconcileTerminalDraft } from './utils';

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

// POST /import-json/reparse — reprocessa mensagens DiscordChatExporter pendentes
router.post('/reparse', requireAdmin, async (req: Request, res: Response) => {
  try {
    // DEB-048-19: validação robusta de messageIds (payload externo)
    const { messageIds: rawIds } = req.body ?? {};
    let messageIds: string[] | undefined;

    if (rawIds !== undefined && rawIds !== null) {
      if (!Array.isArray(rawIds)) {
        return res.status(400).json({ error: 'messageIds deve ser um array de strings.' });
      }
      if (!rawIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
        return res.status(400).json({ error: 'messageIds deve conter apenas strings não-vazias.' });
      }
      messageIds = rawIds as string[];
    }

    // DEB-048-17: lista de status condicional numa ÚNICA cláusula. Múltiplos
    // .where('status',...) são ANDeados pelo Kysely — somar 'parsed' num 2º
    // .where não funcionaria (interseção excluiria 'parsed').
    let query = db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('source_kind', '=', 'discord_chat_exporter_json')
      .where('status', 'in', (messageIds && messageIds.length > 0)
        ? ['pending', 'needs_review', 'parsed']
        : ['pending', 'needs_review']);

    if (messageIds && messageIds.length > 0) {
      query = query.where('discord_message_id', 'in', messageIds);
    }

    const messages = await query.limit(500).execute();

    if (messages.length === 0) {
      return res.json({ data: { total: 0, reparsed: 0, ignored: 0, errors: 0 } });
    }

    let reparsed = 0;
    let ignored = 0;
    let errors = 0;

    for (const message of messages) {
      try {
        // Não reprocessa mensagens synced (segurança extra)
        if (message.status === 'synced') continue;

        const result = await parseDiscordMessage(message);
        if (!result) {
          await db.updateTable('discord_import_messages')
            .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
          ignored++;
          continue;
        }
        const { parsed, normalized } = result;

        const existing = await db.selectFrom('discord_import_table_drafts')
          .select(['id', 'status'])
          .where('discord_message_id', '=', message.id)
          .executeTakeFirst();

        // Reconcilia draft terminal (synced/rejected) — não mexe
        if (await reconcileTerminalDraft(existing, message.id)) {
          reparsed++;
          continue;
        }

        if (existing) {
          await db.updateTable('discord_import_table_drafts')
            .set({
              parsed_payload: parsed,
              normalized_payload: normalized.draft,
              confidence: normalized.draft.confidence,
              status: normalized.status,
              updated_at: new Date(),
            })
            .where('id', '=', existing.id)
            .execute();
        } else {
          await db.insertInto('discord_import_table_drafts')
            .values({
              discord_message_id: message.id,
              parsed_payload: parsed,
              normalized_payload: normalized.draft,
              confidence: normalized.draft.confidence,
              status: normalized.status,
            })
            .execute();
        }

        await db.updateTable('discord_import_messages')
          .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();

        await ensureSystemSuggestionForDraft(
          normalized.draft,
          req.user?.userId,
          message.discord_thread_name ?? message.discord_message_id,
        );

        reparsed++;
      } catch (err: unknown) {
        // DEB-048-20: catch interno próprio + preserva causa
        const errorMessage = err instanceof Error ? err.message : 'unknown error';
        try {
          await db.updateTable('discord_import_messages')
            .set({ status: 'error', parse_error: errorMessage, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
        } catch (dbError: unknown) {
          console.error('[POST /admin/discord-sync/import-json/reparse] DB update failed for message', message.id,
            dbError instanceof Error ? dbError.message : 'unknown db error');
        }
        errors++;
      }
    }

    return res.json({
      data: {
        total: messages.length,
        reparsed,
        ignored,
        errors,
      },
    });
  } catch (error: unknown) {
    respondImportError(res, error);
  }
});

export default router;
