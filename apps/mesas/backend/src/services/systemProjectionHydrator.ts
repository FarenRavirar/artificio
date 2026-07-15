import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db';
import { catalogFetch } from '@artificio/catalog-client';
import { slugifyCatalogSegment } from './catalogClient';

const aliasSchema = z.object({ alias: z.string().trim().min(1) });
const nodeBaseSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  node_type: z.enum(['system', 'edition', 'variant']),
  canonical_slug: z.string().trim().min(1),
  path_slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  name_pt: z.string().nullable(),
  description: z.string().nullable(),
  official_website_url: z.string().nullable(),
  logo_media_id: z.string().nullable(),
  aliases: z.array(aliasSchema),
});

export type ProjectionSnapshotNode = z.infer<typeof nodeBaseSchema> & { children: ProjectionSnapshotNode[] };
const nodeSchema: z.ZodType<ProjectionSnapshotNode> = nodeBaseSchema.extend({
  children: z.lazy(() => z.array(nodeSchema)),
});
const snapshotSchema = z.object({
  catalog_version: z.number().int().positive(),
  generated_at: z.string().datetime(),
  checksum: z.string().min(16),
  nodes_count: z.number().int().nonnegative(),
  tree: z.array(nodeSchema),
  inactive_nodes: z.array(z.object({
    id: z.string().uuid(),
    status: z.enum(['draft', 'pending', 'rejected', 'merged']),
    merged_into_id: z.string().uuid().nullable(),
    version: z.number().int().nonnegative(),
  })),
  redirects: z.array(z.object({
    source_id: z.string().uuid(),
    target_id: z.string().uuid(),
    reason: z.string().nullable(),
  })),
  legacy_mappings: z.array(z.object({
    legacy_id: z.string().uuid(),
    canonical_id: z.string().uuid(),
  })),
});

export type SystemProjectionSnapshot = z.infer<typeof snapshotSchema>;

interface ExistingProjectionNode {
  id: string;
  name: string;
  name_pt: string | null;
  description: string | null;
  parent_id: string | null;
  node_type: 'system' | 'edition' | 'variant';
  depth: number;
  path_slug: string | null;
  slug: string;
  logo_filename: string | null;
  website_url: string | null;
  catalog_source: 'central' | 'beta';
  catalog_status: 'active' | 'archived' | 'merged';
  merged_into_id: string | null;
  central_version: number | null;
  aliases: string[];
}

export interface ProjectionConflict {
  type: 'path_collision' | 'slug_collision' | 'orphan' | 'invalid_hierarchy' | 'invalid_count' | 'invalid_mapping';
  central_id: string;
  local_id?: string;
  value: string;
}

export interface SystemProjectionPlan {
  catalog_version: number;
  checksum: string;
  create: string[];
  update: string[];
  unchanged: string[];
  lifecycle: string[];
  remap: Array<{ legacy_id: string; canonical_id: string }>;
  beta_extra: string[];
  conflicts: ProjectionConflict[];
  nodes: ProjectionSnapshotNode[];
  snapshot: SystemProjectionSnapshot;
}

export async function fetchCentralSystemsSnapshot(): Promise<SystemProjectionSnapshot> {
  const baseUrl = process.env.CENTRAL_SYSTEMS_API_URL?.trim();
  if (!baseUrl) throw new Error('CENTRAL_SYSTEMS_API_URL_missing');
  if (/site-beta|beta\.artificiorpg/i.test(baseUrl)) throw new Error('CENTRAL_SYSTEMS_API_URL_must_be_site_prod');
  const token = process.env.CENTRAL_SYSTEMS_INTERNAL_TOKEN?.trim() || process.env.CATALOG_INTERNAL_TOKEN;
  if (!token) throw new Error('CENTRAL_SYSTEMS_INTERNAL_TOKEN_missing');
  const raw = await catalogFetch<unknown>('/api/admin/v1/catalog/snapshot', { baseUrl, token });
  return snapshotSchema.parse(raw);
}

export async function planSystemProjection(
  providedSnapshot?: SystemProjectionSnapshot,
): Promise<SystemProjectionPlan> {
  const snapshot = providedSnapshot ?? await fetchCentralSystemsSnapshot();
  const [systems, aliases] = await Promise.all([
    db.selectFrom('systems').select([
      'id', 'name', 'name_pt', 'description', 'parent_id', 'node_type', 'depth',
      'path_slug', 'slug', 'logo_filename', 'website_url', 'catalog_source',
      'catalog_status', 'merged_into_id', 'central_version',
    ]).execute(),
    db.selectFrom('system_aliases').select(['system_id', 'alias']).execute(),
  ]);
  const aliasesBySystem = new Map<string, string[]>();
  for (const alias of aliases) {
    const current = aliasesBySystem.get(alias.system_id) ?? [];
    current.push(alias.alias);
    aliasesBySystem.set(alias.system_id, current);
  }
  const existing = systems.map((system) => ({ ...system, aliases: aliasesBySystem.get(system.id) ?? [] }));
  return buildSystemProjectionPlan(snapshot, existing);
}

export function buildSystemProjectionPlan(
  snapshot: SystemProjectionSnapshot,
  existing: ExistingProjectionNode[],
): SystemProjectionPlan {
  const nodes: ProjectionSnapshotNode[] = [];
  const conflicts: ProjectionConflict[] = [];
  const seen = new Set<string>();
  const visit = (node: ProjectionSnapshotNode, expectedParent: string | null, depth: number) => {
    if (seen.has(node.id)) {
      conflicts.push({ type: 'invalid_hierarchy', central_id: node.id, value: 'duplicate_or_cycle' });
      return;
    }
    seen.add(node.id);
    const expectedType = ['system', 'edition', 'variant'][depth];
    if (node.parent_id !== expectedParent || node.node_type !== expectedType || depth > 2) {
      conflicts.push({ type: 'invalid_hierarchy', central_id: node.id, value: `${node.node_type}:${node.parent_id ?? 'root'}` });
    }
    nodes.push(node);
    node.children.forEach((child) => visit(child, node.id, depth + 1));
  };
  snapshot.tree.forEach((root) => visit(root, null, 0));
  if (nodes.length !== snapshot.nodes_count) {
    conflicts.push({ type: 'invalid_count', central_id: 'snapshot', value: `${nodes.length}/${snapshot.nodes_count}` });
  }

  const existingById = new Map(existing.map((node) => [node.id, node]));
  const activeIds = new Set(nodes.map((node) => node.id));
  const inactiveIds = new Set(snapshot.inactive_nodes.map((node) => node.id));
  const mappingByLegacy = new Map<string, string>();
  const mappedExistingByCanonical = new Map<string, ExistingProjectionNode>();
  const remap: Array<{ legacy_id: string; canonical_id: string }> = [];
  for (const mapping of snapshot.legacy_mappings) {
    const previous = mappingByLegacy.get(mapping.legacy_id);
    if (previous && previous !== mapping.canonical_id) {
      conflicts.push({ type: 'invalid_mapping', central_id: mapping.canonical_id, local_id: mapping.legacy_id, value: 'legacy_maps_to_multiple_targets' });
      continue;
    }
    mappingByLegacy.set(mapping.legacy_id, mapping.canonical_id);
    const local = existingById.get(mapping.legacy_id);
    if (!local || mapping.legacy_id === mapping.canonical_id) continue;
    if (!activeIds.has(mapping.canonical_id)) {
      conflicts.push({ type: 'invalid_mapping', central_id: mapping.canonical_id, local_id: mapping.legacy_id, value: 'target_missing_from_snapshot' });
      continue;
    }
    if (local.catalog_status === 'merged'
      && local.merged_into_id === mapping.canonical_id
      && Number(local.central_version) === snapshot.catalog_version) {
      continue;
    }
    if (!mappedExistingByCanonical.has(mapping.canonical_id)) {
      mappedExistingByCanonical.set(mapping.canonical_id, local);
    }
    remap.push({ legacy_id: mapping.legacy_id, canonical_id: mapping.canonical_id });
  }
  const existingByPath = new Map(existing
    .filter((node) => node.catalog_status === 'active' && node.path_slug)
    .map((node) => [node.path_slug!, node]));
  const existingBySlug = new Map(existing
    .filter((node) => node.catalog_status === 'active')
    .map((node) => [node.slug, node]));
  const create: string[] = [];
  const update: string[] = [];
  const unchanged: string[] = [];

  for (const node of nodes) {
    const local = existingById.get(node.id) ?? mappedExistingByCanonical.get(node.id);
    const slug = localSlug(node.path_slug);
    const pathOwner = existingByPath.get(node.path_slug);
    const slugOwner = existingBySlug.get(slug);
    if (pathOwner && pathOwner.id !== node.id && mappingByLegacy.get(pathOwner.id) !== node.id) {
      conflicts.push({ type: 'path_collision', central_id: node.id, local_id: pathOwner.id, value: node.path_slug });
    }
    if (slugOwner && slugOwner.id !== node.id && mappingByLegacy.get(slugOwner.id) !== node.id) {
      conflicts.push({ type: 'slug_collision', central_id: node.id, local_id: slugOwner.id, value: slug });
    }
    if (!local) create.push(node.id);
    else if (local.id !== node.id || !activeNodeMatches(local, node, snapshot.catalog_version)) update.push(node.id);
    else unchanged.push(node.id);
  }

  const redirects = new Map(snapshot.redirects.map((redirect) => [redirect.source_id, redirect.target_id]));
  const lifecycle = snapshot.inactive_nodes.filter((node) => {
    const local = existingById.get(node.id);
    if (!local) return false;
    const status = node.status === 'merged' ? 'merged' : 'archived';
    const target = status === 'merged' ? node.merged_into_id ?? redirects.get(node.id) ?? null : null;
    return local.catalog_source !== 'central' || local.catalog_status !== status
      || local.merged_into_id !== target || local.central_version !== snapshot.catalog_version;
  }).map((node) => node.id);
  const beta_extra = existing
    .filter((node) => node.catalog_source === 'beta' && !mappingByLegacy.has(node.id) && !seen.has(node.id) && !inactiveIds.has(node.id))
    .map((node) => node.id);
  for (const node of existing) {
    if (node.catalog_source === 'central' && !mappingByLegacy.has(node.id)
      && !seen.has(node.id) && !inactiveIds.has(node.id)) {
      conflicts.push({ type: 'orphan', central_id: node.id, local_id: node.id, value: 'central_node_missing_lifecycle' });
    }
  }

  return { catalog_version: snapshot.catalog_version, checksum: snapshot.checksum, create, update, unchanged, lifecycle, remap, beta_extra, conflicts, nodes, snapshot };
}

export async function applySystemProjection(plan: SystemProjectionPlan): Promise<void> {
  if (plan.conflicts.length > 0) throw new Error('system_projection_conflicts');
  const syncedAt = new Date();
  const redirects = new Map(plan.snapshot.redirects.map((redirect) => [redirect.source_id, redirect.target_id]));

  await db.transaction().execute(async (trx) => {
    const projectionNodes = plan.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      name_pt: node.name_pt,
      slug: localSlug(node.path_slug),
      description: node.description,
      parent_id: node.parent_id,
      node_type: node.node_type,
      depth: depthForType(node.node_type),
      path_slug: node.path_slug,
      logo_filename: node.node_type === 'system' ? node.logo_media_id : null,
      website_url: node.node_type === 'system' ? node.official_website_url : null,
    }));
    const projectionAliases = plan.nodes.flatMap((node) => normalizedAliases(
      node.aliases.map((alias) => alias.alias),
    ).map(({ alias, aliasSlug }) => ({ system_id: node.id, alias, alias_slug: aliasSlug })));

    await sql`CREATE TEMP TABLE projection_identity_map ON COMMIT DROP AS
      SELECT legacy_id::uuid, canonical_id::uuid
      FROM jsonb_to_recordset(${JSON.stringify(plan.remap)}::jsonb)
        AS mapping(legacy_id text, canonical_id text)`.execute(trx);
    await sql`CREATE UNIQUE INDEX ON projection_identity_map (legacy_id)`.execute(trx);

    await sql`UPDATE systems AS legacy
      SET catalog_status = 'archived', merged_into_id = NULL
      FROM projection_identity_map AS mapping
      WHERE legacy.id = mapping.legacy_id`.execute(trx);

    await sql`CREATE TEMP TABLE projection_node_data ON COMMIT DROP AS
      SELECT id::uuid, name, name_pt, slug, description, parent_id::uuid, node_type,
        depth::integer, path_slug, logo_filename, website_url
      FROM jsonb_to_recordset(${JSON.stringify(projectionNodes)}::jsonb) AS node(
        id text, name text, name_pt text, slug text, description text, parent_id text,
        node_type text, depth integer, path_slug text, logo_filename text, website_url text
      )`.execute(trx);
    for (const depth of [0, 1, 2]) {
      await sql`INSERT INTO systems (
          id, name, name_pt, slug, description, parent_id, node_type, depth, path_slug,
          logo_filename, website_url, catalog_source, catalog_status, merged_into_id,
          central_version, central_synced_at
        )
        SELECT id, name, name_pt, slug, description, parent_id, node_type, depth, path_slug,
          logo_filename, website_url, 'central', 'active', NULL, ${plan.catalog_version}, ${syncedAt}
        FROM projection_node_data WHERE depth = ${depth}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, name_pt = EXCLUDED.name_pt, slug = EXCLUDED.slug,
          description = EXCLUDED.description, parent_id = EXCLUDED.parent_id,
          node_type = EXCLUDED.node_type, depth = EXCLUDED.depth, path_slug = EXCLUDED.path_slug,
          logo_filename = EXCLUDED.logo_filename, website_url = EXCLUDED.website_url,
          catalog_source = EXCLUDED.catalog_source, catalog_status = EXCLUDED.catalog_status,
          merged_into_id = NULL, central_version = EXCLUDED.central_version,
          central_synced_at = EXCLUDED.central_synced_at`.execute(trx);
    }
    await sql`DELETE FROM system_aliases AS alias
      USING projection_node_data AS node WHERE alias.system_id = node.id`.execute(trx);
    if (projectionAliases.length > 0) {
      await sql`INSERT INTO system_aliases (system_id, alias, alias_slug, is_official)
        SELECT system_id::uuid, alias, alias_slug, true
        FROM jsonb_to_recordset(${JSON.stringify(projectionAliases)}::jsonb)
          AS value(system_id text, alias text, alias_slug text)`.execute(trx);
    }

    // Filhos exclusivos do Beta sobrevivem sob o pai canônico. Nós também
    // remapeados ficam como histórico sob a árvore histórica antiga.
    await sql`UPDATE systems AS child
      SET parent_id = parent_mapping.canonical_id
      FROM projection_identity_map AS parent_mapping
      WHERE child.parent_id = parent_mapping.legacy_id
        AND NOT EXISTS (
          SELECT 1 FROM projection_identity_map AS own_mapping
          WHERE own_mapping.legacy_id = child.id
        )`.execute(trx);

    await sql`UPDATE tables AS target SET system_id = mapping.canonical_id
      FROM projection_identity_map AS mapping
      WHERE target.system_id = mapping.legacy_id`.execute(trx);

    await sql`WITH ranked AS (
      SELECT link.id,
        row_number() OVER (
          PARTITION BY link.user_id, link.type, COALESCE(mapping.canonical_id, link.system_id)
          ORDER BY (mapping.legacy_id IS NULL) DESC, link.created_at, link.id
        ) AS position
      FROM user_systems AS link
      LEFT JOIN projection_identity_map AS mapping ON mapping.legacy_id = link.system_id
      WHERE mapping.legacy_id IS NOT NULL
         OR EXISTS (SELECT 1 FROM projection_identity_map AS target WHERE target.canonical_id = link.system_id)
    )
    DELETE FROM user_systems AS duplicate
    USING ranked
    WHERE duplicate.id = ranked.id AND ranked.position > 1`.execute(trx);
    await sql`UPDATE user_systems AS target SET system_id = mapping.canonical_id
      FROM projection_identity_map AS mapping
      WHERE target.system_id = mapping.legacy_id`.execute(trx);

    await sql`UPDATE user_preferences AS preferences
      SET systems = ARRAY(
          SELECT value FROM (
            SELECT COALESCE(mapping.canonical_id, source.item) AS value,
              min(source.position) AS first_position
            FROM unnest(preferences.systems) WITH ORDINALITY AS source(item, position)
            LEFT JOIN projection_identity_map AS mapping ON mapping.legacy_id = source.item
            GROUP BY 1
          ) deduplicated ORDER BY first_position
        )
      WHERE EXISTS (
        SELECT 1 FROM unnest(preferences.systems) AS item
        JOIN projection_identity_map AS mapping ON mapping.legacy_id = item
      )`.execute(trx);
    await sql`UPDATE gm_profiles AS profile
      SET closed_group_systems = ARRAY(
          SELECT value FROM (
            SELECT COALESCE(mapping.canonical_id, source.item) AS value,
              min(source.position) AS first_position
            FROM unnest(profile.closed_group_systems) WITH ORDINALITY AS source(item, position)
            LEFT JOIN projection_identity_map AS mapping ON mapping.legacy_id = source.item
            GROUP BY 1
          ) deduplicated ORDER BY first_position
        )
      WHERE EXISTS (
        SELECT 1 FROM unnest(profile.closed_group_systems) AS item
        JOIN projection_identity_map AS mapping ON mapping.legacy_id = item
      )`.execute(trx);

    await sql`UPDATE system_suggestions AS target SET parent_id = mapping.canonical_id
      FROM projection_identity_map AS mapping WHERE target.parent_id = mapping.legacy_id`.execute(trx);
    await sql`UPDATE system_suggestions AS target SET resolved_system_id = mapping.canonical_id
      FROM projection_identity_map AS mapping WHERE target.resolved_system_id = mapping.legacy_id`.execute(trx);
    await sql`UPDATE system_suggestions AS target SET created_system_id = mapping.canonical_id
      FROM projection_identity_map AS mapping WHERE target.created_system_id = mapping.legacy_id`.execute(trx);

    await sql`CREATE OR REPLACE FUNCTION pg_temp.remap_projection_system_ids(payload jsonb)
      RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
      DECLARE replacement uuid;
      BEGIN
        IF payload IS NULL THEN RETURN NULL; END IF;
        CASE jsonb_typeof(payload)
          WHEN 'string' THEN
            SELECT canonical_id INTO replacement FROM projection_identity_map
            WHERE legacy_id::text = payload #>> '{}';
            RETURN CASE WHEN replacement IS NULL THEN payload ELSE to_jsonb(replacement::text) END;
          WHEN 'array' THEN
            RETURN COALESCE((SELECT jsonb_agg(pg_temp.remap_projection_system_ids(value))
              FROM jsonb_array_elements(payload)), '[]'::jsonb);
          WHEN 'object' THEN
            RETURN COALESCE((SELECT jsonb_object_agg(key, pg_temp.remap_projection_system_ids(value))
              FROM jsonb_each(payload)), '{}'::jsonb);
          ELSE RETURN payload;
        END CASE;
      END $$`.execute(trx);
    await sql`UPDATE discord_import_table_drafts
      SET parsed_payload = pg_temp.remap_projection_system_ids(parsed_payload),
          normalized_payload = pg_temp.remap_projection_system_ids(normalized_payload)
      WHERE parsed_payload::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
         OR normalized_payload::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'`.execute(trx);
    await sql`UPDATE discord_field_learning
      SET output_value = pg_temp.remap_projection_system_ids(output_value), updated_at = now()
      WHERE output_value::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'`.execute(trx);
    await sql`UPDATE discord_learning_rules
      SET output_value = pg_temp.remap_projection_system_ids(output_value), updated_at = now()
      WHERE output_value::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'`.execute(trx);

    await sql`UPDATE systems AS legacy
      SET catalog_status = 'merged', merged_into_id = mapping.canonical_id,
          central_version = ${plan.catalog_version}, central_synced_at = ${syncedAt}
      FROM projection_identity_map AS mapping
      WHERE legacy.id = mapping.legacy_id`.execute(trx);

    for (const inactive of plan.snapshot.inactive_nodes) {
      const mergedInto = inactive.status === 'merged'
        ? inactive.merged_into_id ?? redirects.get(inactive.id) ?? null
        : null;
      if (inactive.status === 'merged' && !mergedInto) throw new Error(`system_projection_merge_target_missing:${inactive.id}`);
      await trx.updateTable('systems').set({
        catalog_source: 'central',
        catalog_status: inactive.status === 'merged' ? 'merged' : 'archived',
        merged_into_id: mergedInto,
        central_version: plan.catalog_version,
        central_synced_at: syncedAt,
      }).where('id', '=', inactive.id).execute();
    }
  });
}

function localSlug(pathSlug: string): string {
  return pathSlug.split('/').map(slugifyCatalogSegment).filter(Boolean).join('--');
}

function depthForType(nodeType: ProjectionSnapshotNode['node_type']): number {
  return nodeType === 'system' ? 0 : nodeType === 'edition' ? 1 : 2;
}

function normalizedAliases(values: string[]): Array<{ alias: string; aliasSlug: string }> {
  const bySlug = new Map<string, string>();
  for (const value of values) {
    const alias = value.trim();
    const aliasSlug = slugifyCatalogSegment(alias);
    if (alias && aliasSlug && !bySlug.has(aliasSlug)) bySlug.set(aliasSlug, alias);
  }
  return [...bySlug].map(([aliasSlug, alias]) => ({ alias, aliasSlug }));
}

function activeNodeMatches(
  local: ExistingProjectionNode,
  central: ProjectionSnapshotNode,
  catalogVersion: number,
): boolean {
  const localAliases = normalizedAliases(local.aliases).map((item) => item.aliasSlug).sort();
  const centralAliases = normalizedAliases(central.aliases.map((item) => item.alias)).map((item) => item.aliasSlug).sort();
  return local.catalog_source === 'central'
    && local.catalog_status === 'active'
    && local.merged_into_id === null
    && Number(local.central_version) === catalogVersion
    && local.name === central.name
    && local.name_pt === central.name_pt
    && local.description === central.description
    && local.parent_id === central.parent_id
    && local.node_type === central.node_type
    && local.depth === depthForType(central.node_type)
    && local.path_slug === central.path_slug
    && local.slug === localSlug(central.path_slug)
    && local.logo_filename === (central.node_type === 'system' ? central.logo_media_id : null)
    && local.website_url === (central.node_type === 'system' ? central.official_website_url : null)
    && JSON.stringify(localAliases) === JSON.stringify(centralAliases);
}
