import { describe, expect, it } from 'vitest';
import { buildSystemProjectionPlan, type SystemProjectionSnapshot } from './systemProjectionHydrator.js';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const EDITION_ID = '22222222-2222-4222-8222-222222222222';
const EXTRA_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ID = '44444444-4444-4444-8444-444444444444';

type ExistingNode = Parameters<typeof buildSystemProjectionPlan>[1][number];

function existing(overrides: Partial<ExistingNode>): ExistingNode {
  return {
    id: ROOT_ID,
    name: 'Dungeons & Dragons',
    name_pt: null,
    description: null,
    parent_id: null,
    node_type: 'system' as const,
    depth: 0,
    path_slug: 'dungeons-dragons',
    slug: 'dungeons-dragons',
    logo_filename: null,
    website_url: null,
    catalog_source: 'central' as const,
    catalog_status: 'active' as const,
    merged_into_id: null,
    central_version: 7,
    aliases: ['D&D'],
    ...overrides,
  };
}

function snapshot(): SystemProjectionSnapshot {
  return {
    catalog_version: 7,
    generated_at: '2026-07-15T12:00:00.000Z',
    checksum: '0123456789abcdef',
    nodes_count: 2,
    tree: [{
      id: ROOT_ID,
      parent_id: null,
      node_type: 'system',
      canonical_slug: 'dungeons-dragons',
      path_slug: 'dungeons-dragons',
      name: 'Dungeons & Dragons',
      name_pt: null,
      description: null,
      official_website_url: null,
      logo_media_id: null,
      aliases: [{ alias: 'D&D' }],
      children: [{
        id: EDITION_ID,
        parent_id: ROOT_ID,
        node_type: 'edition',
        canonical_slug: '5e',
        path_slug: 'dungeons-dragons/5e',
        name: '5e',
        name_pt: '5ª Edição',
        description: null,
        official_website_url: null,
        logo_media_id: null,
        aliases: [],
        children: [],
      }],
    }],
    inactive_nodes: [],
    redirects: [],
    legacy_mappings: [],
  };
}

describe('buildSystemProjectionPlan', () => {
  it('cria ausentes e preserva extra Beta', () => {
    const plan = buildSystemProjectionPlan(snapshot(), [existing({
      id: EXTRA_ID, name: 'Beta Only', path_slug: 'beta-only', slug: 'beta-only',
      catalog_source: 'beta', central_version: null, aliases: [],
    })]);
    expect(plan.create).toEqual([ROOT_ID, EDITION_ID]);
    expect(plan.beta_extra).toEqual([EXTRA_ID]);
    expect(plan.conflicts).toEqual([]);
  });

  it('é idempotente quando versão e identidade já coincidem', () => {
    const plan = buildSystemProjectionPlan(snapshot(), [
      existing({}),
      existing({ id: EDITION_ID, name: '5e', name_pt: '5ª Edição', parent_id: ROOT_ID, node_type: 'edition', depth: 1, path_slug: 'dungeons-dragons/5e', slug: 'dungeons-dragons--5e', aliases: [] }),
    ]);
    expect(plan.unchanged).toEqual([ROOT_ID, EDITION_ID]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
  });

  it('aborta colisão de path com UUID ativo diferente', () => {
    const plan = buildSystemProjectionPlan(snapshot(), [existing({
      id: OTHER_ID, catalog_source: 'beta', central_version: null,
    })]);
    expect(plan.conflicts.map((item) => item.type)).toEqual(expect.arrayContaining(['path_collision', 'slug_collision']));
  });

  it('não trata histórico arquivado como colisão ativa', () => {
    const plan = buildSystemProjectionPlan(snapshot(), [existing({
      id: OTHER_ID, catalog_status: 'archived', central_version: 6,
    })]);
    expect(plan.conflicts).toEqual([{ type: 'orphan', central_id: OTHER_ID, local_id: OTHER_ID, value: 'central_node_missing_lifecycle' }]);
  });

  it('rejeita variante diretamente sob sistema', () => {
    const bad = snapshot();
    bad.tree[0]!.children[0]!.node_type = 'variant';
    const plan = buildSystemProjectionPlan(bad, []);
    expect(plan.conflicts.some((item) => item.type === 'invalid_hierarchy')).toBe(true);
  });

  it('detecta alteração de nome ou aliases mesmo na mesma versão', () => {
    const plan = buildSystemProjectionPlan(snapshot(), [
      existing({ name: 'Nome antigo', aliases: ['DnD'] }),
      existing({ id: EDITION_ID, name: '5e', name_pt: '5ª Edição', parent_id: ROOT_ID, node_type: 'edition', depth: 1, path_slug: 'dungeons-dragons/5e', slug: 'dungeons-dragons--5e', aliases: [] }),
    ]);
    expect(plan.update).toContain(ROOT_ID);
  });

  it('não repete lifecycle já sincronizado', () => {
    const value = snapshot();
    value.inactive_nodes = [{ id: OTHER_ID, status: 'merged', merged_into_id: ROOT_ID, version: 7 }];
    value.redirects = [{ source_id: OTHER_ID, target_id: ROOT_ID, reason: 'duplicate' }];
    const plan = buildSystemProjectionPlan(value, [
      existing({}),
      existing({ id: EDITION_ID, name: '5e', name_pt: '5ª Edição', parent_id: ROOT_ID, node_type: 'edition', depth: 1, path_slug: 'dungeons-dragons/5e', slug: 'dungeons-dragons--5e', aliases: [] }),
      existing({ id: OTHER_ID, name: 'Duplicado', path_slug: 'duplicado', slug: 'duplicado', catalog_status: 'merged', merged_into_id: ROOT_ID, aliases: [] }),
    ]);
    expect(plan.lifecycle).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it('usa mapping legado para atualizar sem colisão nem criação duplicada', () => {
    const value = snapshot();
    value.legacy_mappings = [{ legacy_id: OTHER_ID, canonical_id: ROOT_ID }];
    const plan = buildSystemProjectionPlan(value, [existing({
      id: OTHER_ID,
      catalog_source: 'beta',
      central_version: null,
    })]);
    expect(plan.remap).toEqual([{ legacy_id: OTHER_ID, canonical_id: ROOT_ID }]);
    expect(plan.create).toEqual([EDITION_ID]);
    expect(plan.update).toEqual([ROOT_ID]);
    expect(plan.beta_extra).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it('aceita vários UUIDs legados convergindo no mesmo canônico', () => {
    const value = snapshot();
    value.legacy_mappings = [
      { legacy_id: OTHER_ID, canonical_id: ROOT_ID },
      { legacy_id: EXTRA_ID, canonical_id: ROOT_ID },
    ];
    const plan = buildSystemProjectionPlan(value, [
      existing({ id: OTHER_ID, catalog_source: 'beta', central_version: null }),
      existing({ id: EXTRA_ID, catalog_source: 'beta', central_version: null }),
    ]);
    expect(plan.remap).toHaveLength(2);
    expect(plan.update).toContain(ROOT_ID);
    expect(plan.conflicts).toEqual([]);
  });

  it('não repete remap legado já concluído', () => {
    const value = snapshot();
    value.legacy_mappings = [{ legacy_id: OTHER_ID, canonical_id: ROOT_ID }];
    const plan = buildSystemProjectionPlan(value, [
      existing({}),
      existing({ id: EDITION_ID, name: '5e', name_pt: '5ª Edição', parent_id: ROOT_ID, node_type: 'edition', depth: 1, path_slug: 'dungeons-dragons/5e', slug: 'dungeons-dragons--5e', aliases: [] }),
      existing({ id: OTHER_ID, catalog_status: 'merged', merged_into_id: ROOT_ID }),
    ]);
    expect(plan.remap).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });
});
