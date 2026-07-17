import { sql } from 'kysely';
import { db } from '../db/index.js';
import { normalizeDraftPayload } from '../discord/syncHelpers.js';

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
  // Achado bot review PR #159: mesma source_url é sinal quase-definitivo
  // (mesmo formulário/link de inscrição); peso original (+0.30) não bastava
  // pra cruzar o limiar de 0.75 usado no scanner quando título/descrição
  // divergem. +0.75 fixo garante que URL idêntica sozinha já qualifica.
  if (sameSourceUrl) score = Math.max(score + 0.30, 0.75);
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

type ActiveTableRow = {
  id: string;
  title: string;
  description: string | null;
  system_id: string | null;
  source_url: string | null;
};

// Achado bot review PR #159: pré-seleção via pg_trgm (extension já habilitada,
// migration_17_setting_and_styles.sql) evita trazer todas as mesas ativas pro
// Node e escorar full-scan O(N²) em memória — Postgres filtra pares prováveis
// (título/descrição com trigram similarity, ou mesma source_url) antes de
// scoreTableDuplicate rodar. Score final/sinais continuam calculados no Node,
// preservando o limiar de 0.75 e a ordenação canônica de id já existentes.
async function preselectActiveTablePairs(): Promise<Array<{ left: ActiveTableRow; right: ActiveTableRow }>> {
  const rows = await sql<{
    left_id: string; left_title: string; left_description: string | null; left_system_id: string | null; left_source_url: string | null;
    right_id: string; right_title: string; right_description: string | null; right_system_id: string | null; right_source_url: string | null;
  }>`
    SELECT
      a.id AS left_id, a.title AS left_title, a.description AS left_description, a.system_id AS left_system_id, a.source_url AS left_source_url,
      b.id AS right_id, b.title AS right_title, b.description AS right_description, b.system_id AS right_system_id, b.source_url AS right_source_url
    FROM tables a
    JOIN tables b ON a.id < b.id
    WHERE a.status = 'active' AND a.archived_at IS NULL
      AND b.status = 'active' AND b.archived_at IS NULL
      AND (
        similarity(lower(a.title), lower(b.title)) >= 0.3
        OR similarity(lower(coalesce(a.description, '')), lower(coalesce(b.description, ''))) >= 0.3
        OR (a.source_url IS NOT NULL AND a.source_url <> '' AND a.source_url = b.source_url)
      )
  `.execute(db);

  return rows.rows.map((row) => ({
    left: { id: row.left_id, title: row.left_title, description: row.left_description, system_id: row.left_system_id, source_url: row.left_source_url },
    right: { id: row.right_id, title: row.right_title, description: row.right_description, system_id: row.right_system_id, source_url: row.right_source_url },
  }));
}

type TableCandidateInsert = {
  table_id: string;
  candidate_table_id: string;
  score: number;
  signals_json: DuplicateSignals;
};

type DraftCandidateInsert = {
  table_id: string;
  candidate_parse_case_id: string;
  score: number;
  signals_json: DuplicateSignals;
};

// SonarCloud PR #159: builders isolam cada fluxo de comparação. Scanner fica
// responsável só por orquestração/persistência, mantendo threshold e sinais.
function buildTableCandidates(
  pairs: Array<{ left: ActiveTableRow; right: ActiveTableRow }>,
): TableCandidateInsert[] {
  const candidates: TableCandidateInsert[] = [];

  for (const { left, right } of pairs) {
    const scored = scoreTableDuplicate(
      { id: left.id, title: left.title, description: left.description ?? '', systemId: left.system_id, sourceUrl: left.source_url },
      { id: right.id, title: right.title, description: right.description ?? '', systemId: right.system_id, sourceUrl: right.source_url },
    );
    if (scored.score >= 0.75) {
      const [tableId, candidateTableId] = left.id < right.id ? [left.id, right.id] : [right.id, left.id];
      candidates.push({ table_id: tableId, candidate_table_id: candidateTableId, score: scored.score, signals_json: scored.signals });
    }
  }

  return candidates;
}

function buildDraftCandidates(
  draftRows: Array<{
    parse_case_id: string;
    draft_id: string | null;
    normalized_payload: unknown;
    parsed_payload: unknown;
  }>,
  activeTables: ActiveTableRow[],
): DraftCandidateInsert[] {
  const candidates: DraftCandidateInsert[] = [];

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

    for (const table of activeTables) {
      const scored = scoreTableDuplicate(draftComparable, {
        id: table.id,
        title: table.title,
        description: table.description ?? '',
        systemId: table.system_id,
        sourceUrl: table.source_url,
      });
      if (scored.score >= 0.75) {
        candidates.push({
          table_id: table.id,
          candidate_parse_case_id: draftRow.parse_case_id,
          score: scored.score,
          signals_json: scored.signals,
        });
      }
    }
  }

  return candidates;
}

export async function scanTableDuplicateCandidates(): Promise<{ tablePairs: number; draftPairs: number }> {
  const pairs = await preselectActiveTablePairs();
  const tableCandidates = buildTableCandidates(pairs);

  const activeTables = await db
    .selectFrom('tables')
    .select(['id', 'title', 'description', 'system_id', 'source_url'])
    .where('status', '=', 'active')
    .where('archived_at', 'is', null)
    .execute();

  const draftRows = await db
    .selectFrom('discord_parse_cases as parse_case')
    .innerJoin('discord_import_table_drafts as draft', 'draft.id', 'parse_case.draft_id')
    .select(['parse_case.id as parse_case_id', 'parse_case.draft_id', 'draft.normalized_payload', 'draft.parsed_payload'])
    .where('draft.status', 'in', ['draft', 'ready', 'needs_review'])
    .distinctOn('parse_case.draft_id')
    .orderBy('parse_case.draft_id')
    .orderBy('parse_case.created_at', 'desc')
    .execute();

  const draftCandidates = buildDraftCandidates(draftRows, activeTables);

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('table_duplicate_candidates').where('status', '=', 'candidate').execute();
    if (tableCandidates.length > 0) await trx.insertInto('table_duplicate_candidates').values(tableCandidates).onConflict((oc) => oc.doNothing()).execute();
    if (draftCandidates.length > 0) await trx.insertInto('table_duplicate_candidates').values(draftCandidates).onConflict((oc) => oc.doNothing()).execute();
  });

  return { tablePairs: tableCandidates.length, draftPairs: draftCandidates.length };
}
