import type { Material } from '../types/material';

// Spec 088 — fixture compartilhada de `Material`.
//
// Havia 8 copias de `makeMaterial` espalhadas pelos testes, e 3 delas estavam
// mal tipadas (inferiam o tipo do proprio valor de exemplo em vez de ancorar
// no schema real), o que escondia campo faltando e congelava enum no valor do
// default. Com uma fonte unica, campo novo no schema quebra em UM lugar, na
// hora, em vez de silenciosamente divergir em oito.
//
// Consumidor que precisa de um caso especifico usa `overrides` — o default
// existe pra ser sobrescrito, nao pra descrever um material "tipico".
export function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    slug: 'material-1',
    title: 'Material 1',
    summary: null,
    description: null,
    material_type: 'adventure',
    access_kind: 'external_link',
    external_url: 'https://example.test/a.pdf',
    creator_id: 'user-1',
    creator_slug: 'criador-1',
    editorial_state: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
