import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getDb, type DbClient } from "../db/connection.js";
import {
  normalizeCatalogWrite,
  slugifyCatalogSegment,
  buildPathSlug,
  replaceAliases,
  bumpVersion,
  type CatalogNodeType,
} from "../db/repo/catalog.js";

interface MesasSystemRow {
  id: string;
  parent_id: string | null;
  node_type: CatalogNodeType;
  slug: string;
  path_slug: string | null;
  name: string;
  name_pt: string | null;
  description: string | null;
  logo_filename: string | null;
  website_url: string | null;
  created_at: string | null;
  aliases: string[];
}

interface ImportReport {
  source_app: "mesas";
  source_environment: "beta" | "prod" | "local";
  generated_at: string;
  dry_run: boolean;
  source: { systems: number; aliases: number };
  imported: { created: number; updated: number; unchanged: number; mappings: number };
  snapshot: { catalog_version: number; nodes_count: number; checksum: string };
  warnings: string[];
}

const SOURCE_APP = "mesas";
const SOURCE_TABLE = "systems";
const sourceEnvironment = parseSourceEnvironment(process.env.CATALOG_SOURCE_ENV ?? "beta");
const dryRun = process.env.CATALOG_IMPORT_DRY_RUN === "true";
const reportPath = process.env.CATALOG_IMPORT_REPORT || resolve(process.cwd(), "catalog-import-report.json");

type ImportCounters = { created: number; updated: number; unchanged: number; mappings: number };

/** Importa cada linha ordenada (pai antes de filho), resolvendo o mapeamento
 * legado→canônico incrementalmente. Extraído de `main` (achado Sonar PR #144:
 * complexidade cognitiva 17 > 15 — loop com 2 branches + awaits encadeados
 * dentro de try/catch/finally inflava a métrica da função inteira). */
async function importOrderedRows(client: DbClient, rows: MesasSystemRow[]): Promise<ImportCounters> {
  const imported: ImportCounters = { created: 0, updated: 0, unchanged: 0, mappings: 0 };
  const legacyToCanonical = new Map<string, string>();
  for (const row of rows) {
    const parentCanonicalId = row.parent_id ? (legacyToCanonical.get(row.parent_id) ?? null) : null;
    if (row.parent_id && !parentCanonicalId) {
      throw new Error(`missing_parent_mapping:${row.id}`);
    }
    const result = await upsertCatalogNode(client, row, parentCanonicalId, dryRun ? null : "mesas-import");
    legacyToCanonical.set(row.id, result.canonicalId);
    imported[result.action] += 1;
    if (!dryRun) {
      await upsertLegacyMapping(client, row, result.canonicalId);
      imported.mappings += 1;
    }
  }
  return imported;
}

async function main(): Promise<void> {
  const rows = await loadMesasRows();
  const aliasesCount = rows.reduce((sum, row) => sum + row.aliases.length, 0);
  const ordered = orderRows(rows);
  const warnings = validateSource(ordered);
  const db = await getDb();
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    const imported = await importOrderedRows(client, ordered);
    const snapshot = await buildSnapshot(client);
    const report: ImportReport = {
      source_app: SOURCE_APP,
      source_environment: sourceEnvironment,
      generated_at: new Date().toISOString(),
      dry_run: dryRun,
      source: { systems: rows.length, aliases: aliasesCount },
      imported,
      snapshot,
      warnings,
    };
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
    await writeReport(report);
    console.log(JSON.stringify(report));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Achado CodeRabbit (PR #144): JSON.parse + `as` cast sem validar shape dos
// itens — Array.isArray cobria só o container, não os campos de cada linha.
// Fonte externa (arquivo local editável) tratada como unknown até checar os
// campos essenciais usados pelo resto do import (id/name/node_type/slug).
function isValidMesasRow(value: unknown): value is MesasSystemRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string"
    && typeof row.node_type === "string" && typeof row.slug === "string";
}

function parseMesasCatalogJson(raw: unknown): MesasSystemRow[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).systems)
      ? (raw as Record<string, unknown>).systems as unknown[]
      : [];
  const valid = list.filter(isValidMesasRow).map((row) => ({ ...row, aliases: Array.isArray(row.aliases) ? row.aliases : [] }));
  if (valid.length !== list.length) {
    console.warn(`[import-mesas-catalog] ${list.length - valid.length} linha(s) do JSON descartada(s) por shape inválido.`);
  }
  return valid;
}

async function loadMesasRows(): Promise<MesasSystemRow[]> {
  const jsonPath = process.env.MESAS_CATALOG_JSON;
  if (jsonPath) {
    const parsed: unknown = JSON.parse(await readFile(jsonPath, "utf-8"));
    return parseMesasCatalogJson(parsed);
  }

  const url = process.env.MESAS_DATABASE_URL;
  if (!url) throw new Error("missing_source: set MESAS_DATABASE_URL or MESAS_CATALOG_JSON");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 30_000 });
  try {
    const result = await pool.query<MesasSystemRow>(
      `SELECT
          s.id::text,
          s.parent_id::text,
          s.node_type,
          s.slug,
          s.path_slug,
          s.name,
          s.name_pt,
          s.description,
          s.logo_filename,
          s.website_url,
          s.created_at::text,
          COALESCE(array_agg(sa.alias ORDER BY sa.alias) FILTER (WHERE sa.alias IS NOT NULL), '{}') AS aliases
       FROM systems s
       LEFT JOIN system_aliases sa ON sa.system_id = s.id
       GROUP BY s.id
       ORDER BY s.depth ASC, s.path_slug ASC, s.name ASC`,
    );
    return result.rows.map((row) => ({ ...row, aliases: row.aliases ?? [] }));
  } finally {
    await pool.end();
  }
}

function orderRows(rows: MesasSystemRow[]): MesasSystemRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const visited = new Set<string>();
  const output: MesasSystemRow[] = [];
  const visit = (row: MesasSystemRow) => {
    if (visited.has(row.id)) return;
    if (row.parent_id && byId.has(row.parent_id)) visit(byId.get(row.parent_id)!);
    visited.add(row.id);
    output.push(row);
  };
  rows.forEach(visit);
  return output;
}

function validateSource(rows: MesasSystemRow[]): string[] {
  const warnings: string[] = [];
  const ids = new Set(rows.map((row) => row.id));
  for (const row of rows) {
    if (row.parent_id && !ids.has(row.parent_id)) warnings.push(`orphan_parent:${row.id}:${row.parent_id}`);
    const expectedSlug = slugifyCatalogSegment(row.name);
    if (!row.slug) warnings.push(`missing_slug:${row.id}`);
    if (!row.path_slug) warnings.push(`missing_path_slug:${row.id}`);
    if (row.node_type !== "system" && !row.parent_id) warnings.push(`non_root_without_parent:${row.id}`);
    if (row.node_type === "system" && row.parent_id) warnings.push(`root_with_parent:${row.id}`);
    if (expectedSlug && row.slug !== expectedSlug) warnings.push(`slug_diff:${row.id}:${row.slug}:${expectedSlug}`);
  }
  return warnings;
}

async function upsertCatalogNode(
  client: DbClient,
  row: MesasSystemRow,
  parentCanonicalId: string | null,
  actorId: string | null,
): Promise<{ canonicalId: string; action: "created" | "updated" | "unchanged" }> {
  const existing = await getExistingMapping(client, row.id);
  const checksum = checksumRow(row);
  if (existing?.checksum === checksum) return { canonicalId: existing.canonical_id, action: "unchanged" };

  const input = normalizeCatalogWrite({
    parent_id: parentCanonicalId,
    node_type: row.node_type,
    canonical_slug: row.slug,
    name: row.name,
    name_pt: row.name_pt,
    description: row.description,
    official_website_url: row.website_url,
    logo_media_id: row.logo_filename,
    status: "active",
    aliases: row.aliases,
  });

  if (existing) {
    await updateCatalogNode(client, existing.canonical_id, input, actorId);
    return { canonicalId: existing.canonical_id, action: "updated" };
  }

  const canonicalId = await insertCatalogNode(client, input, actorId);
  return { canonicalId, action: "created" };
}

async function getExistingMapping(client: DbClient, legacyId: string): Promise<{ canonical_id: string; checksum: string } | null> {
  return (await client.query<{ canonical_id: string; checksum: string }>(
    `SELECT canonical_id, checksum
     FROM catalog_legacy_mappings
     WHERE source_app=$1 AND source_environment=$2 AND source_table=$3 AND legacy_id=$4`,
    [SOURCE_APP, sourceEnvironment, SOURCE_TABLE, legacyId],
  )).rows[0] ?? null;
}

async function insertCatalogNode(client: DbClient, input: ReturnType<typeof normalizeCatalogWrite>, actorId: string | null): Promise<string> {
  const id = cryptoRandomUuid();
  const pathSlug = await buildPathSlug(client, input.parent_id ?? null, input.canonical_slug!);
  await client.query(
    `INSERT INTO catalog_nodes
      (id, parent_id, node_type, canonical_slug, path_slug, name, name_pt, description,
       official_website_url, logo_media_id, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
    [
      id, input.parent_id, input.node_type, input.canonical_slug, pathSlug, input.name, input.name_pt,
      input.description, input.official_website_url, input.logo_media_id, input.status, actorId,
    ],
  );
  await replaceAliases(client, id, input.aliases ?? [], actorId);
  await bumpVersion(client, "catalog_node_imported_from_mesas", actorId, id, { source_environment: sourceEnvironment });
  return id;
}

async function updateCatalogNode(client: DbClient, id: string, input: ReturnType<typeof normalizeCatalogWrite>, actorId: string | null): Promise<void> {
  const pathSlug = await buildPathSlug(client, input.parent_id ?? null, input.canonical_slug!);
  await client.query(
    `UPDATE catalog_nodes
     SET parent_id=$1, node_type=$2, canonical_slug=$3, path_slug=$4, name=$5, name_pt=$6,
         description=$7, official_website_url=$8, logo_media_id=$9, status=$10,
         updated_by=$11, updated_at=now(), version=version+1
     WHERE id=$12`,
    [
      input.parent_id, input.node_type, input.canonical_slug, pathSlug, input.name, input.name_pt,
      input.description, input.official_website_url, input.logo_media_id, input.status, actorId, id,
    ],
  );
  await replaceAliases(client, id, input.aliases ?? [], actorId);
  await bumpVersion(client, "catalog_node_reimported_from_mesas", actorId, id, { source_environment: sourceEnvironment });
}

async function upsertLegacyMapping(client: DbClient, row: MesasSystemRow, canonicalId: string): Promise<void> {
  const checksum = checksumRow(row);
  await client.query(
    `INSERT INTO catalog_legacy_mappings
       (source_app, source_environment, source_table, legacy_id, canonical_id, source_path_slug, source_payload, checksum)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     ON CONFLICT (source_app, source_environment, source_table, legacy_id)
     DO UPDATE SET
       canonical_id=EXCLUDED.canonical_id,
       source_path_slug=EXCLUDED.source_path_slug,
       source_payload=EXCLUDED.source_payload,
       checksum=EXCLUDED.checksum,
       updated_at=now()`,
    [SOURCE_APP, sourceEnvironment, SOURCE_TABLE, row.id, canonicalId, row.path_slug, JSON.stringify(row), checksum],
  );
}

// replaceAliases/buildPathSlug/bumpVersion importados de db/repo/catalog.ts
// (achado CodeRabbit PR #144: eram cópias divergentes daqui — dedup evita
// que as duas implementações saiam de sincronia).

async function buildSnapshot(client: DbClient): Promise<ImportReport["snapshot"]> {
  const version = (await client.query<{ version: number }>(
    "SELECT COALESCE(MAX(version), 1)::int AS version FROM catalog_versions",
  )).rows[0]?.version ?? 1;
  const rows = (await client.query<{ id: string; path_slug: string; version: number }>(
    "SELECT id, path_slug, version FROM catalog_nodes WHERE status='active' ORDER BY path_slug",
  )).rows;
  const checksum = createHash("sha256").update(JSON.stringify({ version, rows })).digest("hex");
  return { catalog_version: version, nodes_count: rows.length, checksum };
}

async function writeReport(report: ImportReport): Promise<void> {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
}

function checksumRow(row: MesasSystemRow): string {
  return createHash("sha256").update(JSON.stringify({
    id: row.id,
    parent_id: row.parent_id,
    node_type: row.node_type,
    slug: row.slug,
    path_slug: row.path_slug,
    name: row.name,
    name_pt: row.name_pt,
    description: row.description,
    logo_filename: row.logo_filename,
    website_url: row.website_url,
    aliases: row.aliases,
  })).digest("hex");
}

function cryptoRandomUuid(): string {
  return randomUUID();
}

function parseSourceEnvironment(value: string): "beta" | "prod" | "local" {
  if (value === "beta" || value === "prod" || value === "local") return value;
  throw new Error("bad_source_environment");
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
