import {
  resolveMaterialTaxonomyPatch,
} from './materialTaxonomy';
import type { FlatCatalogSystem } from './catalogClient';

const nodes: FlatCatalogSystem[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Sistema A', name_pt: null, slug: 'a', path_slug: 'a', node_type: 'system', parent_id: null, aliases: [] },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Edição A', name_pt: null, slug: 'ed-a', path_slug: 'a/ed-a', node_type: 'edition', parent_id: '11111111-1111-4111-8111-111111111111', aliases: [] },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Sistema B', name_pt: null, slug: 'b', path_slug: 'b', node_type: 'system', parent_id: null, aliases: [] },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Variante B', name_pt: null, slug: 'var-b', path_slug: 'b/var-b', node_type: 'variant', parent_id: '33333333-3333-4333-8333-333333333333', aliases: [] },
];

describe('resolveMaterialTaxonomyPatch', () => {
  it('limpa edição incompatível ao trocar sistema sem enviar edição', () => {
    expect(resolveMaterialTaxonomyPatch({
      system_id: nodes[0].id,
      edition_id: nodes[1].id,
    }, {
      system_id: nodes[2].id,
    }, nodes)).toEqual({
      system_id: nodes[2].id,
      edition_id: null,
    });
  });

  it('aceita edição ou variante pertencente ao sistema', () => {
    expect(resolveMaterialTaxonomyPatch({ system_id: null, edition_id: null }, {
      system_id: nodes[2].id,
      edition_id: nodes[3].id,
    }, nodes)).toEqual({
      system_id: nodes[2].id,
      edition_id: nodes[3].id,
    });
  });

  it.each([
    [{ system_id: nodes[1].id }, 'Sistema inválido'],
    [{ system_id: nodes[0].id, edition_id: nodes[3].id }, 'não pertence'],
    [{ system_id: null, edition_id: nodes[1].id }, 'Selecione um sistema'],
  ])('rejeita combinação inválida %#', (patch, message) => {
    expect(() => resolveMaterialTaxonomyPatch({ system_id: null, edition_id: null }, patch, nodes))
      .toThrow(new RegExp(message, 'i'));
  });
});
