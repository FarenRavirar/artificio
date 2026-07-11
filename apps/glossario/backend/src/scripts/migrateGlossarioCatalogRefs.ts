import { db } from '../config/database';
import { getCatalogNodeIndex } from '../services/catalogClient';

interface LegacySystem {
  id: string;
  name: string;
}

interface LegacyEdition {
  id: string;
  name: string;
  system_id: string;
}

interface MappingReport {
  dry_run: boolean;
  systems: Array<{ legacy_id: string; legacy_name: string; canonical_id: string | null; canonical_name: string | null; ambiguous: boolean }>;
  editions: Array<{ legacy_id: string; legacy_name: string; legacy_system_id: string; canonical_id: string | null; canonical_name: string | null }>;
  unresolved: Array<{ type: 'system' | 'edition'; legacy_id: string; name: string }>;
  updates: {
    terms_system_id: number;
    terms_edition_id: number;
    scenarios_system_id: number;
  };
}

// Achado CodeRabbit (PR #145): as LegacySystem[]/as LegacyEdition[] confiava
// cegamente no shape do banco antes de uma migracao com escrita real. Valida
// campos minimos (id/name/system_id string) e FALHA a migracao inteira (nao
// filtra silenciosamente) se achar linha invalida, para nao concluir com
// referencias legadas sem mapeamento que nao apareceriam em `unresolved`.
function parseLegacySystems(rows: unknown): LegacySystem[] {
  if (!Array.isArray(rows)) {
    throw new Error('parseLegacySystems: resultado da query não é um array.');
  }
  return rows.map((row, index) => {
    if (typeof row?.id !== 'string' || typeof row?.name !== 'string' || row.name.trim().length === 0) {
      throw new Error(`parseLegacySystems: linha inválida no índice ${index}: ${JSON.stringify(row)}`);
    }
    return row as LegacySystem;
  });
}

function parseLegacyEditions(rows: unknown): LegacyEdition[] {
  if (!Array.isArray(rows)) {
    throw new Error('parseLegacyEditions: resultado da query não é um array.');
  }
  return rows.map((row, index) => {
    if (
      typeof row?.id !== 'string'
      || typeof row?.name !== 'string' || row.name.trim().length === 0
      || typeof row?.system_id !== 'string'
    ) {
      throw new Error(`parseLegacyEditions: linha inválida no índice ${index}: ${JSON.stringify(row)}`);
    }
    return row as LegacyEdition;
  });
}

type SystemMapping = MappingReport['systems'][number];
type EditionMapping = MappingReport['editions'][number] & { ambiguous: boolean };

// Achado CodeRabbit (PR #145): Map.set sobrescrevia silenciosamente sistemas
// com o mesmo nome normalizado (ultimo escrito vencia sem aviso). Agrupa por
// nome normalizado, igual ao tratamento ja usado para edicoes; nome ambiguo
// (2+ sistemas canonicos) vira unresolved em vez de escolher um ao acaso.
// Achado Sonar (PR #145): logica de mapeamento extraida de main() para reduzir
// complexidade cognitiva (21 -> abaixo de 15).
function buildSystemMappings(legacySystems: LegacySystem[], catalogIndex: Awaited<ReturnType<typeof getCatalogNodeIndex>>): SystemMapping[] {
  const canonicalSystemsByName = new Map<string, { id: string; name: string }[]>();
  for (const node of catalogIndex) {
    if (node.node_type !== 'system') continue;
    const key = normalize(node.name);
    const bucket = canonicalSystemsByName.get(key) ?? [];
    bucket.push({ id: node.id, name: node.name });
    canonicalSystemsByName.set(key, bucket);
  }

  const ambiguousSystemNames = new Set(
    [...canonicalSystemsByName.entries()].filter(([, bucket]) => bucket.length > 1).map(([key]) => key),
  );

  return legacySystems.map((legacy) => {
    const key = normalize(legacy.name);
    const ambiguous = ambiguousSystemNames.has(key);
    const bucket = canonicalSystemsByName.get(key);
    const canonical = !ambiguous && bucket?.length === 1 ? bucket[0] : null;
    return {
      legacy_id: legacy.id,
      legacy_name: legacy.name,
      canonical_id: canonical?.id ?? null,
      canonical_name: canonical?.name ?? null,
      ambiguous,
    };
  });
}

// Achado CodeRabbit (PR #145): edições no catálogo central podem ter nomes
// repetidos ("1ª Edição") sob sistemas diferentes. Chave composta
// (sistema pai canônico + nome normalizado) evita colisão cruzada.
function buildEditionMappings(
  legacyEditions: LegacyEdition[],
  catalogIndex: Awaited<ReturnType<typeof getCatalogNodeIndex>>,
  canonicalSystemIdByLegacyId: Map<string, string>,
): EditionMapping[] {
  const canonicalEditionsByKey = new Map<string, { id: string; name: string }[]>();
  for (const node of catalogIndex) {
    if (node.node_type !== 'edition' || !node.parent_id) continue;
    const key = `${node.parent_id}::${normalize(node.name)}`;
    const bucket = canonicalEditionsByKey.get(key) ?? [];
    bucket.push({ id: node.id, name: node.name });
    canonicalEditionsByKey.set(key, bucket);
  }

  const ambiguousEditionKeys = new Set(
    [...canonicalEditionsByKey.entries()].filter(([, bucket]) => bucket.length > 1).map(([key]) => key),
  );

  return legacyEditions.map((legacy) => {
    const canonicalSystemId = canonicalSystemIdByLegacyId.get(legacy.system_id) ?? null;
    const key = canonicalSystemId ? `${canonicalSystemId}::${normalize(legacy.name)}` : null;
    const bucket = key ? canonicalEditionsByKey.get(key) : undefined;
    const ambiguous = key ? ambiguousEditionKeys.has(key) : false;
    const canonical = !ambiguous && bucket?.length === 1 ? bucket[0] : null;
    return {
      legacy_id: legacy.id,
      legacy_name: legacy.name,
      legacy_system_id: legacy.system_id,
      canonical_id: canonical?.id ?? null,
      canonical_name: canonical?.name ?? null,
      ambiguous,
    };
  });
}

function buildUnresolved(systemMappings: SystemMapping[], editionMappings: EditionMapping[]): MappingReport['unresolved'] {
  return [
    ...systemMappings
      .filter((row) => !row.canonical_id)
      .map((row) => ({
        type: 'system' as const,
        legacy_id: row.legacy_id,
        name: row.ambiguous ? `${row.legacy_name} (ambíguo: múltiplos sistemas canônicos com este nome)` : row.legacy_name,
      })),
    ...editionMappings
      .filter((row) => !row.canonical_id)
      .map((row) => ({
        type: 'edition' as const,
        legacy_id: row.legacy_id,
        name: row.ambiguous ? `${row.legacy_name} (ambíguo: múltiplas edições com este nome sob o mesmo sistema pai)` : row.legacy_name,
      })),
  ];
}

// Achado CodeRabbit (PR #145): cada UPDATE era confirmado isoladamente — erro
// no meio deixava terms/scenarios parcialmente migrados. Uma unica transacao
// (BEGIN/COMMIT/ROLLBACK) garante tudo-ou-nada.
async function applyMappings(
  systemMappings: SystemMapping[],
  editionMappings: EditionMapping[],
  updates: MappingReport['updates'],
): Promise<void> {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of systemMappings) {
      if (!row.canonical_id || row.legacy_id === row.canonical_id) continue;
      updates.terms_system_id += await updateRef(client, 'terms', 'system_id', row.legacy_id, row.canonical_id);
      updates.scenarios_system_id += await updateRef(client, 'scenarios', 'system_id', row.legacy_id, row.canonical_id);
    }
    for (const row of editionMappings) {
      if (!row.canonical_id || row.legacy_id === row.canonical_id) continue;
      updates.terms_edition_id += await updateRef(client, 'terms', 'edition_id', row.legacy_id, row.canonical_id);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const apply = process.env.GLOSSARIO_CATALOG_MIGRATION_APPLY === 'true';
  const [legacySystemsResult, legacyEditionsResult, catalogIndex] = await Promise.all([
    db.query('SELECT id, name FROM public.systems ORDER BY name'),
    db.query('SELECT id, name, system_id FROM public.editions ORDER BY name'),
    getCatalogNodeIndex(),
  ]);
  const legacySystems = parseLegacySystems(legacySystemsResult.rows);
  const legacyEditions = parseLegacyEditions(legacyEditionsResult.rows);

  const systemMappings = buildSystemMappings(legacySystems, catalogIndex);
  const canonicalSystemIdByLegacyId = new Map(
    systemMappings.filter((row) => row.canonical_id).map((row) => [row.legacy_id, row.canonical_id!]),
  );
  const editionMappings = buildEditionMappings(legacyEditions, catalogIndex, canonicalSystemIdByLegacyId);
  const unresolved = buildUnresolved(systemMappings, editionMappings);

  const report: MappingReport = {
    dry_run: !apply,
    systems: systemMappings,
    editions: editionMappings,
    unresolved,
    updates: {
      terms_system_id: 0,
      terms_edition_id: 0,
      scenarios_system_id: 0,
    },
  };

  if (apply) {
    if (unresolved.length > 0) {
      // Achado Sonar (PR #145): template literal aninhado — extraido para
      // variavel intermediaria antes da interpolacao externa.
      const unresolvedLabels = unresolved.map((item) => `${item.type}:${item.name}`);
      throw new Error(`Unresolved catalog refs: ${unresolvedLabels.join(', ')}`);
    }
    await applyMappings(systemMappings, editionMappings, report.updates);
  }

  console.log(JSON.stringify(report, null, 2));
  await db.pool.end();
}

async function updateRef(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rowCount: number | null }> },
  table: 'terms' | 'scenarios',
  column: 'system_id' | 'edition_id',
  fromId: string,
  toId: string,
): Promise<number> {
  const result = await client.query(`UPDATE public.${table} SET ${column} = $2 WHERE ${column} = $1`, [fromId, toId]);
  return result.rowCount ?? 0;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

void main().catch(async (error) => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
