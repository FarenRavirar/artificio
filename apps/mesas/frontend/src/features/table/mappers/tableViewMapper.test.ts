import { describe, it, expect } from 'vitest';
import { normalizeNumeric, mapTableToView } from './tableViewMapper';
import type { TableDetail } from '../../../types/tables';

// normalizeNumeric é a fronteira que converte NUMERIC do pg (string sem parser
// para o OID 1700) no view model da página da mesa. Estrito por tipo: boolean,
// string vazia/só espaços e demais tipos devolvem undefined — Number() direto
// coagiria true→1 e ''→0, fabricando preço onde não existe (achado Codex
// PR #283, segunda rodada).
describe('normalizeNumeric — fronteira NUMERIC do view model', () => {
  it('aceita number finito', () => {
    expect(normalizeNumeric(50)).toBe(50);
    expect(normalizeNumeric(39.9)).toBe(39.9);
  });

  it('aceita string não-branca que parseia para number finito (formato do pg)', () => {
    expect(normalizeNumeric('50.00')).toBe(50);
    expect(normalizeNumeric('39.90')).toBe(39.9);
  });

  it('devolve undefined para null/undefined', () => {
    expect(normalizeNumeric(null)).toBeUndefined();
    expect(normalizeNumeric(undefined)).toBeUndefined();
  });

  it('devolve undefined para boolean (true coagiria para 1)', () => {
    expect(normalizeNumeric(true)).toBeUndefined();
    expect(normalizeNumeric(false)).toBeUndefined();
  });

  it('devolve undefined para string vazia ou só espaços (coagiriam para 0)', () => {
    expect(normalizeNumeric('')).toBeUndefined();
    expect(normalizeNumeric('   ')).toBeUndefined();
  });

  it('devolve undefined para valores não numéricos e não finitos', () => {
    expect(normalizeNumeric('abc')).toBeUndefined();
    expect(normalizeNumeric(NaN)).toBeUndefined();
    expect(normalizeNumeric(Infinity)).toBeUndefined();
    expect(normalizeNumeric({})).toBeUndefined();
    expect(normalizeNumeric(['50'])).toBeUndefined();
  });
});

/**
 * Fixture mínima de TableDetail para os testes de mapeamento. Apenas os
 * campos obrigatórios do contrato (types/tables.ts); o resto entra por
 * override em cada caso.
 */
function makeTableDetail(overrides: Partial<TableDetail> = {}): TableDetail {
  return {
    id: 'table-1',
    slug: 'mesa-teste',
    title: 'Mesa teste',
    description: null,
    cover_url: null,
    status: 'active',
    type: 'campanha',
    audience: 'livre',
    modality: 'online',
    price_type: 'gratuita',
    price_value: null,
    slots_total: 5,
    slots_filled: 1,
    slots_open: 4,
    language: 'pt-BR',
    experience_level: 'intermediario',
    featured: false,
    publisher_role: 'gm',
    actual_gm_name: null,
    contacts: [],
    system_name: 'Dungeons & Dragons',
    system_slug: 'dungeons-dragons',
    gm_slug: null,
    gm_avatar_url: null,
    gm_display_name: 'Mestre Teste',
    gm_bio_long: null,
    is_ddal: false,
    is_covil: false,
    created_at: '2026-08-21T00:00:00.000Z',
    price_frequency: null,
    price_value_monthly: null,
    accepts_donations: false,
    suggested_donation_value: null,
    starts_at: null,
    city: null,
    state: null,
    content_warnings: [],
    safety_tools: [],
    table_gm_bio: null,
    ...overrides,
  };
}

// R24/A27 (spec 096): a faixa etária é normalizada para o enum do produto na
// entrada do ViewModel; a decisão de EXIBIR é dos componentes. 'livre' É
// exibido, como marcador discreto "Livre" (decisão do mantenedor, 2026-08-24);
// o que não aparece é ausente/fora do enum. O VM carrega o dado para os dois
// lados decidirem igual.
describe('mapTableToView — ageRating (R24/A27)', () => {
  it('mapeia faixa etária real da API para o ViewModel', () => {
    const vm = mapTableToView(makeTableDetail({ age_rating: '+16' }));
    expect(vm.ageRating).toBe('+16');
  });

  it('preserva "livre" no ViewModel (a UI o renderiza como "Livre")', () => {
    const vm = mapTableToView(makeTableDetail({ age_rating: 'livre' }));
    expect(vm.ageRating).toBe('livre');
  });

  it('mapeia faixa ausente (null) como undefined, sem quebrar', () => {
    const vm = mapTableToView(makeTableDetail({ age_rating: null }));
    expect(vm.ageRating).toBeUndefined();
  });
});

// T7.2b (spec 096): `rules_notes` (regras da própria mesa) e `ddal_rules_notes`
// (nota da certificação DDAL) são campos diferentes com nomes parecidos — o VM
// os mantém em lugares distintos para que um nunca sobrescreva o outro.
describe('mapTableToView — tableRules (T7.2b)', () => {
  it('leva rules_notes para vm.tableRules', () => {
    const vm = mapTableToView(makeTableDetail({ rules_notes: 'Sem PVP.' }));
    expect(vm.tableRules).toBe('Sem PVP.');
  });

  it('mapeia rules_notes ausente como undefined', () => {
    const vm = mapTableToView(makeTableDetail({ rules_notes: null }));
    expect(vm.tableRules).toBeUndefined();
  });

  it('mantém ddal_rules_notes na certificação, separado de tableRules', () => {
    const vm = mapTableToView(
      makeTableDetail({
        is_ddal: true,
        ddal_rules_notes: 'Nota DDAL',
        rules_notes: 'Regras da mesa',
      }),
    );
    expect(vm.certifications.ddal?.rulesNotes).toBe('Nota DDAL');
    expect(vm.tableRules).toBe('Regras da mesa');
  });
});
