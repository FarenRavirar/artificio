import { randomUUID } from "node:crypto";
import { getDb, type DbClient } from "../connection.js";

export type CatalogNodeType = "system" | "edition" | "variant";
export type CatalogNodeStatus = "draft" | "pending" | "active" | "rejected" | "merged";

export interface CatalogAlias {
  id: number;
  node_id: string;
  alias: string;
  locale: string | null;
  kind: string;
}

export interface CatalogNodeRow {
  id: string;
  parent_id: string | null;
  node_type: CatalogNodeType;
  canonical_slug: string;
  path_slug: string;
  name: string;
  name_pt: string | null;
  description: string | null;
  official_website_url: string | null;
  logo_media_id: string | null;
  status: CatalogNodeStatus;
  merged_into_id: string | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  aliases: CatalogAlias[];
}

export interface CatalogTreeNode extends CatalogNodeRow {
  children: CatalogTreeNode[];
}

export interface CatalogInactiveNode {
  id: string;
  status: Exclude<CatalogNodeStatus, "active">;
  merged_into_id: string | null;
  version: number;
}

export interface CatalogRedirect {
  source_id: string;
  target_id: string;
  reason: string | null;
}

export interface CatalogSnapshot {
  catalog_version: number;
  generated_at: string;
  checksum: string;
  nodes_count: number;
  tree: CatalogTreeNode[];
  inactive_nodes: CatalogInactiveNode[];
  redirects: CatalogRedirect[];
}

export interface CatalogLegacyMapping {
  legacy_id: string;
  canonical_id: string;
}

export interface CatalogProjectionSnapshot extends CatalogSnapshot {
  legacy_mappings: CatalogLegacyMapping[];
}

export interface CatalogNodeWrite {
  parent_id?: string | null;
  node_type: CatalogNodeType;
  canonical_slug?: string;
  name: string;
  name_pt?: string | null;
  description?: string | null;
  official_website_url?: string | null;
  logo_media_id?: string | null;
  status?: CatalogNodeStatus;
  aliases?: string[];
}

const NODE_TYPES = new Set<CatalogNodeType>(["system", "edition", "variant"]);
const STATUSES = new Set<CatalogNodeStatus>(["draft", "pending", "active", "rejected", "merged"]);
export const CATALOG_PARENT_TYPE: Record<CatalogNodeType, CatalogNodeType | null> = {
  system: null,
  edition: "system",
  variant: "edition",
};

export function validateCatalogHierarchyShape(
  nodeType: CatalogNodeType,
  parentType: CatalogNodeType | null,
): "parent_required" | "root_parent_forbidden" | "hierarchy_invalid" | null {
  const expected = CATALOG_PARENT_TYPE[nodeType];
  if (expected === null) return parentType === null ? null : "root_parent_forbidden";
  if (parentType === null) return "parent_required";
  return parentType === expected ? null : "hierarchy_invalid";
}

export function slugifyCatalogSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("&", " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeCatalogWrite(input: CatalogNodeWrite): CatalogNodeWrite {
  const name = input.name.trim();
  const canonical_slug = (input.canonical_slug?.trim() || slugifyCatalogSegment(name)).slice(0, 80);
  if (!name) throw new Error("name_required");
  if (!canonical_slug) throw new Error("slug_required");
  if (!NODE_TYPES.has(input.node_type)) throw new Error("bad_node_type");
  if (input.status && !STATUSES.has(input.status)) throw new Error("bad_status");
  return {
    parent_id: input.parent_id ?? null,
    node_type: input.node_type,
    canonical_slug,
    name,
    name_pt: cleanOptional(input.name_pt),
    description: cleanOptional(input.description),
    official_website_url: cleanOptional(input.official_website_url),
    logo_media_id: cleanOptional(input.logo_media_id),
    status: input.status ?? "active",
    aliases: cleanAliases(input.aliases),
  };
}

export async function getCatalogVersion(): Promise<number> {
  const db = await getDb();
  return (await db.query<{ version: number }>(
    "SELECT COALESCE(MAX(version), 1)::int AS version FROM catalog_versions",
  )).rows[0]?.version ?? 1;
}

export async function listActiveNodes(): Promise<CatalogNodeRow[]> {
  const db = await getDb();
  const nodes = (await db.query<Omit<CatalogNodeRow, "aliases">>(
    `SELECT * FROM catalog_nodes
     WHERE status = 'active'
     ORDER BY path_slug ASC, name ASC`,
  )).rows;
  return attachAliases(nodes, await listAliases(nodes.map((node) => node.id)));
}

export async function getSnapshot(): Promise<CatalogSnapshot> {
  const catalog_version = await getCatalogVersion();
  const nodes = await listActiveNodes();
  const [inactive_nodes, redirects] = await Promise.all([listInactiveNodes(), listRedirects()]);
  const checksum = await buildChecksum(catalog_version, nodes, inactive_nodes, redirects);
  return {
    catalog_version,
    generated_at: new Date().toISOString(),
    checksum,
    nodes_count: nodes.length,
    tree: buildTree(nodes),
    inactive_nodes,
    redirects,
  };
}

export async function getProjectionSnapshot(): Promise<CatalogProjectionSnapshot> {
  const snapshot = await getSnapshot();
  return { ...snapshot, legacy_mappings: await listMesasLegacyMappings() };
}

export async function resolveNode(idOrPath: string): Promise<CatalogNodeRow | { redirect: true; source_id: string; target_id: string } | null> {
  const db = await getDb();
  const redirect = (await db.query<{ source_id: string; target_id: string }>(
    "SELECT source_id, target_id FROM catalog_redirects WHERE source_id = $1",
    [idOrPath],
  )).rows[0];
  if (redirect) return { redirect: true, ...redirect };

  const rows = (await db.query<Omit<CatalogNodeRow, "aliases">>(
    `SELECT * FROM catalog_nodes
     WHERE (id = $1 OR path_slug = $1) AND status = 'active'
     LIMIT 1`,
    [idOrPath],
  )).rows;
  const [node] = await attachAliases(rows, await listAliases(rows.map((row) => row.id)));
  return node ?? null;
}

export async function createNode(input: CatalogNodeWrite, actorId: string | null): Promise<CatalogNodeRow> {
  const db = await getDb();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const normalized = normalizeCatalogWrite(input);
    await assertCatalogHierarchy(client, normalized.node_type, normalized.parent_id ?? null);
    const row = await insertNode(client, normalized, actorId);
    await bumpVersion(client, "catalog_node_created", actorId, row.id, { node_type: row.node_type });
    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateNode(id: string, input: Partial<CatalogNodeWrite>, actorId: string | null): Promise<CatalogNodeRow | null> {
  const db = await getDb();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const existing = (await client.query<CatalogNodeRow>("SELECT * FROM catalog_nodes WHERE id = $1", [id])).rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return null;
    }
    // Achado CodeRabbit (PR #144): `??` trata `null` (intenção de limpar campo
    // via PATCH) igual a `undefined` (campo não enviado) — caía sempre no
    // existing, tornando impossível limpar campos anuláveis. `undefined` é o
    // único sinal de "não enviado"; `null` explícito deve prevalecer.
    const next = normalizeCatalogWrite({
      parent_id: input.parent_id !== undefined ? input.parent_id : existing.parent_id,
      node_type: input.node_type ?? existing.node_type,
      canonical_slug: input.canonical_slug ?? existing.canonical_slug,
      name: input.name ?? existing.name,
      name_pt: input.name_pt !== undefined ? input.name_pt : existing.name_pt,
      description: input.description !== undefined ? input.description : existing.description,
      official_website_url: input.official_website_url !== undefined ? input.official_website_url : existing.official_website_url,
      logo_media_id: input.logo_media_id !== undefined ? input.logo_media_id : existing.logo_media_id,
      status: input.status ?? existing.status,
      aliases: input.aliases,
    });
    await assertCatalogHierarchy(client, next.node_type, next.parent_id ?? null, id);
    const path_slug = await buildPathSlug(client, next.parent_id ?? null, next.canonical_slug!);
    const row = (await client.query<Omit<CatalogNodeRow, "aliases">>(
      `UPDATE catalog_nodes
       SET parent_id=$1, node_type=$2, canonical_slug=$3, path_slug=$4, name=$5, name_pt=$6,
           description=$7, official_website_url=$8, logo_media_id=$9, status=$10,
           updated_by=$11, updated_at=now(), version=version+1
       WHERE id=$12
       RETURNING *`,
      [
        next.parent_id, next.node_type, next.canonical_slug, path_slug, next.name, next.name_pt,
        next.description, next.official_website_url, next.logo_media_id, next.status, actorId, id,
      ],
    )).rows[0]!;
    if (input.aliases) await replaceAliases(client, id, input.aliases, actorId);
    await bumpVersion(client, "catalog_node_updated", actorId, id, { node_type: row.node_type });
    await client.query("COMMIT");
    const [withAliases] = await attachAliases([row], await listAliases([id]));
    return withAliases ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function assertCatalogHierarchy(
  client: DbClient,
  nodeType: CatalogNodeType,
  parentId: string | null,
  nodeId?: string,
): Promise<void> {
  if (!parentId) {
    const shapeError = validateCatalogHierarchyShape(nodeType, null);
    if (shapeError) throw new Error(shapeError);
    return;
  }
  if (nodeId && parentId === nodeId) throw new Error("hierarchy_cycle");
  const parent = (await client.query<{ node_type: CatalogNodeType }>(
    "SELECT node_type FROM catalog_nodes WHERE id = $1",
    [parentId],
  )).rows[0];
  if (!parent) throw new Error("parent_not_found");
  const shapeError = validateCatalogHierarchyShape(nodeType, parent.node_type);
  if (shapeError) throw new Error(shapeError);
  if (!nodeId) return;
  const createsCycle = (await client.query<{ cycle: boolean }>(
    `WITH RECURSIVE descendants AS (
       SELECT id FROM catalog_nodes WHERE parent_id = $1
       UNION ALL
       SELECT child.id FROM catalog_nodes child JOIN descendants parent ON child.parent_id = parent.id
     )
     SELECT EXISTS (SELECT 1 FROM descendants WHERE id = $2) AS cycle`,
    [nodeId, parentId],
  )).rows[0]?.cycle ?? false;
  if (createsCycle) throw new Error("hierarchy_cycle");
}

async function insertNode(client: DbClient, input: CatalogNodeWrite, actorId: string | null): Promise<CatalogNodeRow> {
  const id = randomUUID();
  const path_slug = await buildPathSlug(client, input.parent_id ?? null, input.canonical_slug!);
  const row = (await client.query<Omit<CatalogNodeRow, "aliases">>(
    `INSERT INTO catalog_nodes
      (id, parent_id, node_type, canonical_slug, path_slug, name, name_pt, description,
       official_website_url, logo_media_id, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
     RETURNING *`,
    [
      id, input.parent_id, input.node_type, input.canonical_slug, path_slug, input.name, input.name_pt,
      input.description, input.official_website_url, input.logo_media_id, input.status, actorId,
    ],
  )).rows[0]!;
  await replaceAliases(client, id, input.aliases ?? [], actorId);
  const [withAliases] = await attachAliases([row], await listAliases([id]));
  return withAliases!;
}

// Achado CodeRabbit (PR #144): função exportada pra reuso no importador
// (import-mesas-catalog.ts) — antes duplicada lá, divergindo do canônico aqui.
export async function buildPathSlug(client: DbClient, parentId: string | null, slug: string): Promise<string> {
  if (!parentId) return slug;
  const parent = (await client.query<{ path_slug: string }>(
    "SELECT path_slug FROM catalog_nodes WHERE id = $1",
    [parentId],
  )).rows[0];
  if (!parent) throw new Error("parent_not_found");
  return `${parent.path_slug}/${slug}`;
}

// Achado CodeRabbit (PR #144): exportada pro mesmo motivo de buildPathSlug.
export async function replaceAliases(client: DbClient, nodeId: string, aliases: string[], actorId: string | null): Promise<void> {
  await client.query("DELETE FROM catalog_aliases WHERE node_id = $1", [nodeId]);
  for (const alias of cleanAliases(aliases)) {
    await client.query(
      "INSERT INTO catalog_aliases (node_id, alias, created_by) VALUES ($1,$2,$3)",
      [nodeId, alias, actorId],
    );
  }
}

// Achado CodeRabbit (PR #144): exportada pro mesmo motivo de buildPathSlug.
export async function bumpVersion(client: DbClient, reason: string, actorId: string | null, nodeId: string | null, payload: unknown): Promise<void> {
  // Achado CodeRabbit (PR #144): MAX(version)+1 sem lock permite duas
  // transações concorrentes calcularem o mesmo `next` e uma falhar com
  // duplicate key (catalog_versions.version é UNIQUE). LOCK TABLE serializa
  // escritores dentro da mesma transação (BEGIN/COMMIT do caller) sem exigir
  // migration nova de sequence.
  await client.query("LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE");
  const next = (await client.query<{ version: number }>(
    "SELECT COALESCE(MAX(version), 0)::int + 1 AS version FROM catalog_versions",
  )).rows[0]?.version ?? 1;
  await client.query("INSERT INTO catalog_versions (version, reason, created_by) VALUES ($1,$2,$3)", [next, reason, actorId]);
  await client.query(
    "INSERT INTO catalog_audit_events (node_id, event_type, actor_id, payload, catalog_version) VALUES ($1,$2,$3,$4::jsonb,$5)",
    [nodeId, reason, actorId, JSON.stringify(payload), next],
  );
}

async function listAliases(nodeIds: string[]): Promise<CatalogAlias[]> {
  if (nodeIds.length === 0) return [];
  const db = await getDb();
  const placeholders = nodeIds.map((_, index) => `$${index + 1}`).join(",");
  return (await db.query<CatalogAlias>(
    `SELECT * FROM catalog_aliases WHERE node_id IN (${placeholders}) ORDER BY alias ASC`,
    nodeIds,
  )).rows;
}

async function listInactiveNodes(): Promise<CatalogInactiveNode[]> {
  const db = await getDb();
  return (await db.query<CatalogInactiveNode>(
    `SELECT id, status, merged_into_id, version
       FROM catalog_nodes
      WHERE status <> 'active'
      ORDER BY id ASC`,
  )).rows;
}

async function listRedirects(): Promise<CatalogRedirect[]> {
  const db = await getDb();
  return (await db.query<CatalogRedirect>(
    `SELECT source_id, target_id, reason
       FROM catalog_redirects
      ORDER BY source_id ASC`,
  )).rows;
}

async function listMesasLegacyMappings(): Promise<CatalogLegacyMapping[]> {
  const db = await getDb();
  return (await db.query<CatalogLegacyMapping>(
    `SELECT legacy_id, canonical_id
       FROM catalog_legacy_mappings
      WHERE source_app = 'mesas' AND source_environment = 'prod'
        AND source_table = 'systems'
      ORDER BY legacy_id ASC`,
  )).rows;
}

async function attachAliases<T extends Omit<CatalogNodeRow, "aliases">>(nodes: T[], aliases: CatalogAlias[]): Promise<CatalogNodeRow[]> {
  const byNode = new Map<string, CatalogAlias[]>();
  for (const alias of aliases) {
    byNode.set(alias.node_id, [...(byNode.get(alias.node_id) ?? []), alias]);
  }
  return nodes.map((node) => ({ ...node, aliases: byNode.get(node.id) ?? [] }));
}

function buildTree(nodes: CatalogNodeRow[]): CatalogTreeNode[] {
  const byId = new Map<string, CatalogTreeNode>();
  for (const node of nodes) byId.set(node.id, { ...node, children: [] });
  const roots: CatalogTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

async function buildChecksum(
  version: number,
  nodes: CatalogNodeRow[],
  inactiveNodes: CatalogInactiveNode[],
  redirects: CatalogRedirect[],
): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256")
    .update(JSON.stringify({
      version,
      nodes: nodes.map(({ id, path_slug, version: nodeVersion }) => [id, path_slug, nodeVersion]),
      inactiveNodes,
      redirects,
    }))
    .digest("hex");
}

function cleanOptional(value: string | null | undefined): string | null {
  const clean = (value ?? "").trim();
  return clean.length > 0 ? clean : null;
}

function cleanAliases(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).slice(0, 20);
}
