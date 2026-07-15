import { db } from '../db';
import { prodDb } from '../db/prod';
import { planSystemProjection, type SystemProjectionSnapshot } from './systemProjectionHydrator';

export type SystemIdResolver = (id: string) => string;

export interface MesasHydrationSystemGuard {
  catalog_version: number;
  references: number;
  resolveSystemId: SystemIdResolver;
}

export function createSystemIdResolver(snapshot: SystemProjectionSnapshot): SystemIdResolver {
  const targets = new Map<string, string>();
  snapshot.redirects.forEach((entry) => targets.set(entry.source_id, entry.target_id));
  snapshot.legacy_mappings.forEach((entry) => targets.set(entry.legacy_id, entry.canonical_id));

  return (id: string) => {
    let current = id;
    const visited = new Set<string>();
    while (targets.has(current)) {
      if (visited.has(current)) throw new Error(`system_projection_identity_cycle:${id}`);
      visited.add(current);
      current = targets.get(current)!;
    }
    return current;
  };
}

function requireSystemIdArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((id): id is string => typeof id === 'string')) {
    throw new Error(`system_projection_invalid_${field}_array`);
  }
  return value;
}

function remapSystemIdArray(value: unknown, field: string, resolveSystemId: SystemIdResolver): string[] {
  const remapped = requireSystemIdArray(value, field).map(resolveSystemId);
  return [...new Set(remapped)];
}

export function remapHydratedSystemReferences(
  tableName: string,
  record: Record<string, unknown>,
  resolveSystemId: SystemIdResolver,
): Record<string, unknown> {
  if ((tableName === 'tables' || tableName === 'user_systems') && typeof record.system_id === 'string') {
    record.system_id = resolveSystemId(record.system_id);
  }
  if (tableName === 'user_preferences') {
    record.systems = remapSystemIdArray(record.systems, 'systems', resolveSystemId);
  }
  if (tableName === 'gm_profiles') {
    record.closed_group_systems = remapSystemIdArray(record.closed_group_systems, 'closed_group_systems', resolveSystemId);
  }
  return record;
}

export async function assertMesasHydrationSystemReady(): Promise<MesasHydrationSystemGuard> {
  const plan = await planSystemProjection();
  if (plan.conflicts.length > 0 || plan.create.length > 0 || plan.update.length > 0 || plan.lifecycle.length > 0) {
    throw new Error('system_projection_not_ready');
  }
  const resolveSystemId = createSystemIdResolver(plan.snapshot);

  const [tables, userSystems, preferences, gmProfiles, localSystems] = await Promise.all([
    prodDb.selectFrom('tables').select('system_id').where('system_id', 'is not', null).execute(),
    prodDb.selectFrom('user_systems').select('system_id').execute(),
    prodDb.selectFrom('user_preferences').select('systems').execute(),
    prodDb.selectFrom('gm_profiles').select('closed_group_systems').execute(),
    db.selectFrom('systems').select('id').execute(),
  ]);

  const referenced = new Set<string>();
  tables.forEach((row) => { if (row.system_id) referenced.add(resolveSystemId(row.system_id)); });
  userSystems.forEach((row) => referenced.add(resolveSystemId(row.system_id)));
  preferences.forEach((row) => requireSystemIdArray(row.systems, 'systems')
    .forEach((id) => referenced.add(resolveSystemId(id))));
  gmProfiles.forEach((row) => requireSystemIdArray(row.closed_group_systems, 'closed_group_systems')
    .forEach((id) => referenced.add(resolveSystemId(id))));

  const localIds = new Set(localSystems.map((row) => row.id));
  const missing = [...referenced].filter((id) => !localIds.has(id));
  if (missing.length > 0) throw new Error(`system_projection_missing_references:${missing.join(',')}`);

  return { catalog_version: plan.catalog_version, references: referenced.size, resolveSystemId };
}
