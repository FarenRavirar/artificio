import { describe, expect, it } from 'vitest';
import {
  normalizeSellingPoints,
  normalizeMestreProfile,
  type MestrePublicData,
  type SellingPoint,
} from './useMestre';

/**
 * Normalizadores de entrada do perfil do mestre (spec 099, criterios A5/A9).
 *
 * `selling_points` vem cru do banco: em 7/12 perfis do beta e `{}` (JSONB) em
 * vez de array. O cast do payload (`as GmProfilePayload`) nao valida nada, e o
 * `?? []` dos consumidores nao protege contra objeto — a normalizacao aqui e
 * o que garante `SellingPoint[]` para todo render.
 */

function fakeProfile(overrides: Partial<MestrePublicData> = {}): MestrePublicData {
  return {
    id: 'm1',
    slug: 'mestre-teste',
    display_name: 'Mestre Teste',
    bio_long: null,
    avatar_url: null,
    avatar_crop_data: null,
    avatar_width: null,
    avatar_height: null,
    banner_url: null,
    banner_crop_data: null,
    banner_width: null,
    banner_height: null,
    languages: [],
    specialties: [],
    badges: [],
    avg_rating: null,
    reviews_count: 0,
    tables_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    tables: [],
    ...overrides,
  };
}

describe('normalizeSellingPoints', () => {
  it('devolve [] para objeto vazio (caso real do beta)', () => {
    expect(normalizeSellingPoints({})).toEqual([]);
  });

  it('devolve [] para string serializada', () => {
    expect(normalizeSellingPoints('[]')).toEqual([]);
  });

  it('devolve [] para null e undefined', () => {
    expect(normalizeSellingPoints(null)).toEqual([]);
    expect(normalizeSellingPoints(undefined)).toEqual([]);
  });

  it('filtra itens sem icon, com title nao-string ou description vazia', () => {
    const input = [
      { title: 'Pontual', description: 'Comeco no horario' }, // sem icon
      { icon: 'clock', title: 42, description: 'x' }, // title nao-string
      { icon: 'clock', title: 'Pontual', description: '' }, // description vazia
      { icon: 'clock', title: '', description: 'x' }, // title vazio
      null,
      42,
      'solto',
      [1, 2],
    ];
    expect(normalizeSellingPoints(input)).toEqual([]);
  });

  it('preserva item valido completo, com highlight opcional', () => {
    const input = [
      {
        icon: 'clock',
        title: 'Pontual',
        description: 'Comeco no horario combinado',
        highlight: '100% das sessoes',
      },
      {
        icon: 'sparkles',
        title: 'Imersao',
        description: 'Cenarios ricos',
        highlight: 42, // nao-string: omitido
      },
      { icon: 'shield', title: 'Seguranca', description: 'Sessao zero' }, // sem highlight
    ];
    expect(normalizeSellingPoints(input)).toEqual([
      {
        icon: 'clock',
        title: 'Pontual',
        description: 'Comeco no horario combinado',
        highlight: '100% das sessoes',
      },
      { icon: 'sparkles', title: 'Imersao', description: 'Cenarios ricos' },
      { icon: 'shield', title: 'Seguranca', description: 'Sessao zero' },
    ]);
  });

  it('nao lanca com payload hostil', () => {
    expect(() => normalizeSellingPoints(new Date())).not.toThrow();
    expect(() => normalizeSellingPoints(() => {})).not.toThrow();
    expect(() => normalizeSellingPoints({ icon: { weird: true } })).not.toThrow();
  });
});

describe('normalizeMestreProfile — selling_points na fronteira', () => {
  it('normaliza {} (forma real do beta) para []', () => {
    const out = normalizeMestreProfile(
      fakeProfile({ selling_points: {} as unknown as SellingPoint[] }),
    );
    expect(out?.selling_points).toEqual([]);
  });

  it('normaliza string "[]" para []', () => {
    const out = normalizeMestreProfile(
      fakeProfile({ selling_points: '[]' as unknown as SellingPoint[] }),
    );
    expect(out?.selling_points).toEqual([]);
  });

  it('normaliza array misto, filtrando itens invalidos', () => {
    const out = normalizeMestreProfile(
      fakeProfile({
        selling_points: [
          { icon: 'clock', title: 'Pontual', description: 'x', highlight: 'Sempre' },
          { icon: 'x', title: '', description: 'y' }, // invalido: filtrado
        ],
      }),
    );
    expect(out?.selling_points).toEqual([
      { icon: 'clock', title: 'Pontual', description: 'x', highlight: 'Sempre' },
    ]);
  });

  it('preserva os demais campos normalizados (avatar/banner/avg_rating)', () => {
    const out = normalizeMestreProfile(
      fakeProfile({ selling_points: {} as unknown as SellingPoint[], avg_rating: '4.50' as unknown as number }),
    );
    expect(out?.avatar_crop_data).toBeNull();
    expect(out?.banner_crop_data).toBeNull();
    expect(out?.avg_rating).toBe(4.5);
    expect(out?.selling_points).toEqual([]);
  });
});
