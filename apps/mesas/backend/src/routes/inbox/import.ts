import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft, normalizeDraftPayload } from '../../discord/index.js';
import { requireAdmin } from '../../middleware/auth.js';
import { textToRawMessage } from '../../inbox/adapters/textToRawMessage.js';
import { segmentAnnouncements } from '../../inbox/segmentation.js';
import { stripNullBytes } from '../../discord/parseDiscordAnnouncement.js';
import { loadSystemsForParser } from '../../discord/shared.js';
import { normalizeLooseText } from '../../inbox/normalizeLooseText.js';
import { parseActionFromNormalizedStatus, recordParseCase } from '../../discord/parseLearning.js';
import { toNumberOrNull, importTextSchema } from './utils.js';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────────

interface TableFieldsForMissing {
  title?: unknown;
  system_id?: unknown;
  raw_system_hint?: unknown;
  type?: unknown;
  modality?: unknown;
  slots_total?: unknown;
  slots_open?: unknown;
}

/** Calcula campos obrigatórios faltantes em um rascunho de mesa. */
function calcMissingFields(table: TableFieldsForMissing | undefined): string[] {
  const missing: string[] = [];
  if (!table?.title) missing.push('title');
  if (!table?.system_id) missing.push(table?.raw_system_hint ? 'system_name:unmatched_hint' : 'system_name');
  if (!table?.type) missing.push('type');
  if (!table?.modality) missing.push('modality');
  if (table?.slots_total == null && table?.slots_open == null) missing.push('slots_total');
  return missing;
}

/** Cria um novo registro em import_messages e retorna o ID. */
async function createImportMessage(
  segment: string,
  contentHash: string,
  titleHint: string | null | undefined,
): Promise<string | null> {
  const [inserted] = await db
    .insertInto('import_messages')
    .values({
      source_type: 'manual_paste',
      raw_text: segment,
      content_raw: segment,
      thread_name: titleHint ?? null,
      content_hash: contentHash,
      status: 'pending',
    })
    .returning('id')
    .execute();
  return inserted?.id ?? null;
}

// ─── POST /import-text ──────────────────────────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = importTextSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Payload inválido.' });
    }

    const { text, title_hint } = parsed.data;
    const systems = await loadSystemsForParser();
    const segments = segmentAnnouncements(text);

    const created: Array<{
      id: string;
      title: string | null;
      status: string;
      confidence: number | null;
      missing_fields: string[];
    }> = [];

    for (const rawSegment of segments) {
      // Achado Codex (PR #168): createImportMessage gravava o segmento cru —
      // 0x00 vindo da colagem manual quebrava o INSERT em import_messages
      // antes mesmo de textToRawMessage (que só sanitiza pro parse, não pro
      // persist) entrar em ação. Sanitiza uma vez, usa em hash/insert/parse.
      // Spec 079: só o caminho de texto colado manual perde `\n` reais entre
      // labels ao ser copiado do cliente Discord — normaliza antes do hash/
      // parse. Import via JSON nunca passa por esta rota.
      const segment = normalizeLooseText(stripNullBytes(rawSegment));
      const contentHash = crypto.createHash('sha256').update(segment).digest('hex');

      const existingMessage = await db
        .selectFrom('import_messages')
        .select(['id'])
        .where('content_hash', '=', contentHash)
        .executeTakeFirst();

      if (existingMessage) {
        const existingDraft = await db
          .selectFrom('discord_import_table_drafts')
          .select(['id', 'status', 'confidence', 'normalized_payload'])
          .where('import_message_id', '=', existingMessage.id)
          .executeTakeFirst();

        if (existingDraft) {
          const payload = normalizeDraftPayload(existingDraft.normalized_payload);
          const table = payload.table as Record<string, unknown> | undefined;
          const missingFields = calcMissingFields(table);

          created.push({
            id: existingDraft.id,
            title: (table?.title as string) ?? null,
            status: existingDraft.status,
            confidence: toNumberOrNull(existingDraft.confidence),
            missing_fields: missingFields,
          });
          continue;
        }
      }

      let importMessageId: string;
      if (existingMessage) {
        importMessageId = existingMessage.id;
      } else {
        const newId = await createImportMessage(segment, contentHash, title_hint);
        if (!newId) continue;
        importMessageId = newId;
      }

      const rawMessage = textToRawMessage(segment, title_hint);
      const parsedDraft = parseDiscordAnnouncement(rawMessage, systems);

      if (!parsedDraft) {
        await db
          .updateTable('import_messages')
          .set({ status: 'error', parse_error: 'Mensagem sem conteúdo elegível para virar draft.' })
          .where('id', '=', importMessageId)
          .execute();
        await recordParseCase({
          message: {
            ...rawMessage,
            id: importMessageId,
            source_kind: 'manual_paste',
            attachments: [],
            embeds: [],
          },
          discordMessageId: null,
          importMessageId,
          deterministicResult: null,
          finalResult: null,
          finalAction: 'ignore',
        });
        continue;
      }

      const enrichedDraft = normalizeDiscordTableDraft(parsedDraft, systems);

      const normalized = enrichedDraft;

      const [draftRow] = await db
        .insertInto('discord_import_table_drafts')
        .values({
          discord_message_id: null,
          import_message_id: importMessageId,
          parsed_payload: parsedDraft,
          normalized_payload: normalized.draft,
          confidence: normalized.draft.confidence,
          status: normalized.status,
        })
        .returning(['id', 'status', 'confidence'])
        .execute();

      // REV-063: guarda defensiva contra draftRow undefined
      if (!draftRow) {
        console.error('[import-text] Insert retornou sem linha. importMessageId:', importMessageId);
        continue;
      }

      await db
        .updateTable('import_messages')
        .set({ status: 'parsed' })
        .where('id', '=', importMessageId)
        .execute();

      await recordParseCase({
        message: {
          ...rawMessage,
          id: importMessageId,
          source_kind: 'manual_paste',
          attachments: [],
          embeds: [],
        },
        discordMessageId: null,
        importMessageId,
        draftId: draftRow.id,
        deterministicResult: parsedDraft,
        finalResult: normalized.draft,
        finalAction: parseActionFromNormalizedStatus(normalized.status),
      });

      const missingFields = calcMissingFields(normalized.draft.table as unknown as TableFieldsForMissing);

      created.push({
        id: draftRow.id,
        title: normalized.draft.table.title ?? null,
        status: draftRow.status,
        confidence: toNumberOrNull(draftRow.confidence),
        missing_fields: missingFields,
      });
    }

    return res.json({
      data: {
        segments_found: segments.length,
        drafts_created: created.length,
        drafts: created,
      },
    });
  } catch (error: unknown) {
    console.error('[POST /api/v1/admin/import/import-text]', error);
    return res.status(500).json({ error: 'Erro ao importar texto.' });
  }
});

export default router;
