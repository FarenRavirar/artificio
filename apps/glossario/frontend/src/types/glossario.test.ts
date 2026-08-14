import { describe, expect, it } from 'vitest';

import { normalizeTermo, normalizeTermos } from './glossario';

describe('normalizeTermo', () => {
  it('descarta payload sem id utilizável', () => {
    for (const ruim of [null, undefined, [], 'texto', { name_pt: 'sem id' }, { id: {} }, { id: '' }]) {
      expect(normalizeTermo(ruim)).toBeNull();
    }
    expect(normalizeTermo({ id: 0 })).not.toBeNull();
  });

  // Achado de review da PR #261: `{ ...payload } as Termo` copiava para o
  // estado React qualquer chave que o servidor mandasse, e a asserção calava o
  // compilador sobre campos nunca validados.
  it('não copia chave arbitrária do payload', () => {
    const termo = normalizeTermo({
      id: 't1',
      name_pt: 'Bola de Fogo',
      __proto__polluted: true,
      campoInventado: 'x',
    });
    expect(termo).not.toBeNull();
    expect(Object.keys(termo!)).not.toContain('campoInventado');
    expect(Object.keys(termo!)).not.toContain('__proto__polluted');
  });

  it('rejeita valor fora do domínio nas uniões fechadas', () => {
    const termo = normalizeTermo({
      id: 't1',
      nucleus: 'inventado',
      status: 'aprovadissimo',
      source_type: 'outro',
    });
    expect(termo?.nucleus).toBeUndefined();
    expect(termo?.status).toBeUndefined();
    expect(termo?.source_type).toBeUndefined();
  });

  it('preserva valor válido das uniões fechadas', () => {
    const termo = normalizeTermo({
      id: 't1',
      nucleus: 'oficial',
      status: 'pendente',
      source_type: 'sistema',
    });
    expect(termo?.nucleus).toBe('oficial');
    expect(termo?.status).toBe('pendente');
    expect(termo?.source_type).toBe('sistema');
  });

  it('mantém nomes como string e distingue null de ausente nos campos anuláveis', () => {
    const termo = normalizeTermo({
      id: 't1',
      name_en: 'Fireball',
      name_pt: 42,
      book_reference: null,
      page_reference: '120',
    });
    expect(termo?.name_en).toBe('Fireball');
    // Campo malformado vira string vazia, não `undefined`: os dois nomes são
    // obrigatórios no tipo e vão direto ao render.
    expect(termo?.name_pt).toBe('');
    expect(termo?.book_reference).toBeNull();
    expect(termo?.page_reference).toBe('120');
    expect(termo?.system_id).toBeUndefined();
  });

  it('descarta vote_score não finito', () => {
    expect(normalizeTermo({ id: 't1', vote_score: 7 })?.vote_score).toBe(7);
    for (const ruim of [NaN, Infinity, '7', null]) {
      expect(normalizeTermo({ id: 't1', vote_score: ruim })?.vote_score).toBeUndefined();
    }
  });
});

describe('normalizeTermos', () => {
  it('vira lista vazia quando o payload não é array', () => {
    for (const ruim of [null, undefined, {}, 'texto']) {
      expect(normalizeTermos(ruim)).toEqual([]);
    }
  });

  it('descarta itens inválidos e mantém o resto', () => {
    expect(normalizeTermos([{ id: 'a' }, null, { name_pt: 'sem id' }, { id: 'b' }])
      .map((t) => t.id)).toEqual(['a', 'b']);
  });
});
