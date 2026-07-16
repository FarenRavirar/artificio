import crypto from 'node:crypto';
import { normalizeLooseText } from '../inbox/normalizeLooseText';
import { segmentAnnouncements } from '../inbox/segmentation';
import { textToRawMessage } from '../inbox/adapters/textToRawMessage';
import { parseDiscordAnnouncement, stripNullBytes } from './parseDiscordAnnouncement';
import type { SystemEntry } from './parseDiscordAnnouncement';
import { buildTableDraftFields, extractContacts, extractSchedules } from './syncHelpers';
import { recordParseCase } from './parseLearning';
import type { ImportTableDraft } from './types';

export interface ParsePreviewResult {
  parseCaseId: string | null;
  table: Record<string, unknown> | null;
  contacts: ReturnType<typeof extractContacts>;
  schedules: ReturnType<typeof extractSchedules>;
}

/**
 * Requisito 8 (spec 079): reaproveita a MESMA engine do fluxo admin
 * (segmentação + normalizador de labels grudados + parser +
 * buildTableDraftFields/extractContacts/extractSchedules já usados pelo sync
 * real de Discord/texto colado) para o fluxo PÚBLICO de pré-preenchimento no
 * `create-table`. Nenhuma lógica de parsing/tradução de campo é duplicada —
 * só o ponto de entrada (texto livre do mestre em vez de anúncio de Discord)
 * e a ausência de persistência em `discord_import_table_drafts`/
 * `import_messages` (não é fluxo de curadoria admin) são diferentes.
 *
 * Pega só o PRIMEIRO segmento quando o texto colado contém múltiplos
 * anúncios — o fluxo público cria uma mesa por vez.
 *
 * Grava um `discord_parse_cases` com `final_action: 'draft'` e
 * `final_result_json: null` (ninguém confirmou ainda) — o id retornado
 * (`parseCaseId`) é reenviado pelo front na submissão real (`parse_case_id`
 * no payload de `POST /gm/tables`), fechando o loop de aprendizado com a
 * correção humana quando o mestre publica.
 */
export async function parseTextForPreview(
  rawText: string,
  systems: SystemEntry[] = [],
): Promise<ParsePreviewResult> {
  const segments = segmentAnnouncements(rawText);
  const firstSegment = segments[0];
  if (!firstSegment) {
    return { parseCaseId: null, table: null, contacts: [], schedules: [] };
  }

  const normalized = normalizeLooseText(stripNullBytes(firstSegment));
  const rawMessage = textToRawMessage(normalized, undefined);
  const draft = parseDiscordAnnouncement(rawMessage, systems);

  if (!draft) {
    return { parseCaseId: null, table: null, contacts: [], schedules: [] };
  }

  const gmName = draft.table.raw_gm_name;
  const tableFields = buildTableDraftFields(draft, gmName, draft.table.cover_url ?? null);
  const contacts = extractContacts(draft);
  const schedules = extractSchedules(draft);

  const parseCaseId = await recordPreviewCase(rawMessage, draft);

  return {
    parseCaseId,
    table: tableFields as unknown as Record<string, unknown>,
    contacts,
    schedules,
  };
}

async function recordPreviewCase(
  rawMessage: { content_raw: string },
  draft: ImportTableDraft,
): Promise<string | null> {
  // ParseLearningMessage exige um `id` (correlação com discord_message_id/
  // import_message_id na curadoria admin) — este fluxo não tem nenhum dos
  // dois, é só o sinal de "veio do preview público". UUID descartável.
  const previewMessageId = crypto.randomUUID();
  return recordParseCase({
    message: { id: previewMessageId, content_raw: rawMessage.content_raw },
    discordMessageId: null,
    importMessageId: null,
    deterministicResult: draft,
    finalResult: null,
    finalAction: 'draft',
  });
}
