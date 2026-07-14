import { db } from '../db';
import { normalizeDraftPayload } from '../discord/syncHelpers';

export type DuplicateSignals = {
  title_similarity: number;
  description_similarity: number;
  same_source_url: boolean;
  same_system: boolean;
};

export type DuplicateComparable = {
  id: string;
  title: string;
  description: string;
  systemId: string | null;
  sourceUrl: string | null;
};

export type ScoredDuplicatePair = {
  score: number;
  signals: DuplicateSignals;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function trigrams(value: string): Set<string> {
  const normalized = `  ${normalizeText(value)} `;
  const result = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    result.add(normalized.slice(index, index + 3));
  }
  return result;
}

export function textSimilarity(left: string, right: string): number {
  if (!normalizeText(left) || !normalizeText(right)) return 0;
  const a = trigrams(left);
  const b = trigrams(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

export function scoreTableDuplicate(left: DuplicateComparable, right: DuplicateComparable): ScoredDuplicatePair {
  const titleSimilarity = textSimilarity(left.title, right.title);
  const descriptionSimilarity = textSimilarity(left.description, right.description);
  const sameSourceUrl = Boolean(left.sourceUrl && right.sourceUrl && left.sourceUrl === right.sourceUrl);
  const sameSystem = Boolean(left.systemId && right.systemId && left.systemId === right.systemId);

  let score = titleSimilarity * 0.52 + descriptionSimilarity * 0.36;
  if (sameSourceUrl) score += 0.30;
  if (sameSystem) score += 0.08;

  return {
    score: Math.min(1, Math.max(0, score)),
    signals: {
      title_similarity: titleSimilarity,
      description_similarity: descriptionSimilarity,
      same_source_url: sameSourceUrl,
      same_system: sameSystem,
    },
  };
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function scanTableDuplicateCandidates(): Promise<{ tablePairs: number; draftPairs: number }> {
  const tables = await db
    .selectFrom('tables')
    .select(['id', 'title', 'description', 'system_id', 'source_url'])
    .where('status', '=', 'active')
    .execute();

  const tableCandidates: Array<{
    table_id: string;
    candidate_table_id: string;
    score: number;
    signals_json: DuplicateSignals;
  }> = [];

  for (let leftIndex = 0; leftIndex < tables.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < tables.length; rightIndex += 1) {
      const left = tables[leftIndex];
      const right = tables[rightIndex];
      const scored = scoreTableDuplicate(
        { id: left.id, title: left.title, description: left.description ?? '', systemId: left.system_id, sourceUrl: left.source_url },
        { id: right.id, title: right.title, description: right.description ?? '', systemId: right.system_id, sourceUrl: right.source_url },
      );
      if (scored.score >= 0.75) {
        const [tableId, candidateTableId] = left.id < right.id ? [left.id, right.id] : [right.id, left.id];
        tableCandidates.push({ table_id: tableId, candidate_table_id: candidateTableId, score: scored.score, signals_json: scored.signals });
      }
    }
  }

  const draftRows = await db
    .selectFrom('discord_parse_cases as parse_case')
    .innerJoin('discord_import_table_drafts as draft', 'draft.id', 'parse_case.draft_id')
    .select(['parse_case.id as parse_case_id', 'parse_case.draft_id', 'draft.normalized_payload', 'draft.parsed_payload'])
    .where('draft.status', 'in', ['draft', 'ready', 'needs_review'])
    .distinctOn('parse_case.draft_id')
    .orderBy('parse_case.draft_id')
    .orderBy('parse_case.created_at', 'desc')
    .execute();

  const draftCandidates: Array<{
    table_id: string;
    candidate_parse_case_id: string;
    score: number;
    signals_json: DuplicateSignals;
  }> = [];

  for (const draftRow of draftRows) {
    const payload = normalizeDraftPayload(draftRow.normalized_payload ?? draftRow.parsed_payload);
    const tablePayload = payload.table;
    if (!tablePayload || typeof tablePayload !== 'object' || Array.isArray(tablePayload)) continue;
    const draftTable = tablePayload as Record<string, unknown>;
    const title = readString(draftTable, 'title');
    if (!title) continue;
    const draftComparable: DuplicateComparable = {
      id: draftRow.draft_id ?? draftRow.parse_case_id,
      title,
      description: readString(draftTable, 'description') ?? '',
      systemId: readString(draftTable, 'system_id'),
      sourceUrl: readString(draftTable, 'contact_url') ?? readString(draftTable, 'source_url'),
    };

    for (const table of tables) {
      const scored = scoreTableDuplicate(draftComparable, {
        id: table.id,
        title: table.title,
        description: table.description ?? '',
        systemId: table.system_id,
        sourceUrl: table.source_url,
      });
      if (scored.score >= 0.75) {
        draftCandidates.push({
          table_id: table.id,
          candidate_parse_case_id: draftRow.parse_case_id,
          score: scored.score,
          signals_json: scored.signals,
        });
      }
    }
  }

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('table_duplicate_candidates').where('status', '=', 'candidate').execute();
    if (tableCandidates.length > 0) await trx.insertInto('table_duplicate_candidates').values(tableCandidates).onConflict((oc) => oc.doNothing()).execute();
    if (draftCandidates.length > 0) await trx.insertInto('table_duplicate_candidates').values(draftCandidates).onConflict((oc) => oc.doNothing()).execute();
  });

  return { tablePairs: tableCandidates.length, draftPairs: draftCandidates.length };
}
