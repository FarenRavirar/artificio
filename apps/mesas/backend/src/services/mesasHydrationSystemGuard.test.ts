import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prodRows, localRows, planMock } = vi.hoisted(() => ({
  prodRows: new Map<string, unknown[]>(),
  localRows: [] as Array<{ id: string }>,
  planMock: vi.fn(),
}));

function query(rows: unknown[]) {
  const chain = {
    select: vi.fn(),
    where: vi.fn(),
    execute: vi.fn().mockResolvedValue(rows),
  };
  chain.select.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

vi.mock('../db/prod', () => ({
  prodDb: { selectFrom: (table: string) => query(prodRows.get(table) ?? []) },
}));
vi.mock('../db', () => ({
  db: { selectFrom: () => query(localRows) },
}));
vi.mock('./systemProjectionHydrator', () => ({ planSystemProjection: planMock }));

import {
  assertMesasHydrationSystemReady,
  remapHydratedSystemReferences,
} from './mesasHydrationSystemGuard.js';

const SYSTEM_ID = '11111111-1111-4111-8111-111111111111';
const LEGACY_ID = '22222222-2222-4222-8222-222222222222';

describe('assertMesasHydrationSystemReady', () => {
  beforeEach(() => {
    prodRows.clear();
    localRows.splice(0, localRows.length, { id: SYSTEM_ID });
    planMock.mockReset().mockResolvedValue({
      catalog_version: 9,
      create: [], update: [], lifecycle: [], conflicts: [],
      snapshot: { redirects: [], legacy_mappings: [] },
    });
  });

  it('aceita referências de mesas, perfis e preferências presentes na projeção', async () => {
    prodRows.set('tables', [{ system_id: SYSTEM_ID }]);
    prodRows.set('user_systems', [{ system_id: SYSTEM_ID }]);
    prodRows.set('user_preferences', [{ systems: [SYSTEM_ID] }]);
    prodRows.set('gm_profiles', [{ closed_group_systems: [SYSTEM_ID] }]);
    await expect(assertMesasHydrationSystemReady()).resolves.toMatchObject({ catalog_version: 9, references: 1 });
  });

  it('bloqueia quando a projeção ainda precisa sincronizar', async () => {
    planMock.mockResolvedValue({ catalog_version: 9, create: [SYSTEM_ID], update: [], lifecycle: [], conflicts: [] });
    await expect(assertMesasHydrationSystemReady()).rejects.toThrow('system_projection_not_ready');
  });

  it('bloqueia referência órfã antes da hidratação Mesas', async () => {
    prodRows.set('tables', [{ system_id: LEGACY_ID }]);
    await expect(assertMesasHydrationSystemReady()).rejects.toThrow('system_projection_missing_references');
  });

  it('valida e expõe referência canônica para UUID legado', async () => {
    prodRows.set('tables', [{ system_id: LEGACY_ID }]);
    planMock.mockResolvedValue({
      catalog_version: 9,
      create: [], update: [], lifecycle: [], conflicts: [],
      snapshot: {
        redirects: [],
        legacy_mappings: [{ legacy_id: LEGACY_ID, canonical_id: SYSTEM_ID }],
      },
    });

    const guard = await assertMesasHydrationSystemReady();
    expect(guard.references).toBe(1);
    expect(guard.resolveSystemId(LEGACY_ID)).toBe(SYSTEM_ID);
  });

  it('remapeia e deduplica os quatro payloads de sistema hidratados', () => {
    const resolve = (id: string) => id === LEGACY_ID ? SYSTEM_ID : id;
    expect(remapHydratedSystemReferences('tables', { system_id: LEGACY_ID }, resolve)).toEqual({ system_id: SYSTEM_ID });
    expect(remapHydratedSystemReferences('user_systems', { system_id: LEGACY_ID }, resolve)).toEqual({ system_id: SYSTEM_ID });
    expect(remapHydratedSystemReferences('user_preferences', { systems: [LEGACY_ID, SYSTEM_ID] }, resolve)).toEqual({ systems: [SYSTEM_ID] });
    expect(remapHydratedSystemReferences('gm_profiles', { closed_group_systems: [LEGACY_ID, SYSTEM_ID] }, resolve)).toEqual({ closed_group_systems: [SYSTEM_ID] });
  });
});
