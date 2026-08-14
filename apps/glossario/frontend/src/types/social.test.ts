import { describe, expect, it } from 'vitest';

import {
  normalizeCategories,
  normalizeCategory,
  normalizeComment,
  normalizeComments,
  normalizeEdition,
  normalizeEditions,
  normalizeScenarios,
  normalizeSystem,
  normalizeSystems,
  normalizeVoteScore,
  formatarDataCurta,
} from './social';

/**
 * Estes normalizadores são a barreira entre a resposta da API e o render.
 * Antes deles, `setEditions(res.data)` / `setComments(data)` /
 * `setVoteScore(data.vote_score)` entravam direto no estado, e o tipo local de
 * cada tela descrevia o que ela esperava, não o que o servidor devolve
 * (achado de review, PR #260).
 *
 * O que se testa aqui é o comportamento sob payload HOSTIL — resposta de erro
 * com corpo HTML, campo faltando, deploy no meio da requisição. O caminho feliz
 * é a parte fácil; o que quebrava a tela era o resto.
 */

describe('normalizadores de lista', () => {
  it('devolve lista vazia para qualquer payload que não seja array', () => {
    for (const hostil of [null, undefined, 0, '', 'erro', { items: [] }, true]) {
      expect(normalizeEditions(hostil)).toEqual([]);
      expect(normalizeComments(hostil)).toEqual([]);
      expect(normalizeSystems(hostil)).toEqual([]);
      expect(normalizeScenarios(hostil)).toEqual([]);
      expect(normalizeCategories(hostil)).toEqual([]);
    }
  });

  it('descarta item inutilizável e mantém o resto da lista', () => {
    // Um registro corrompido no meio não pode zerar a lista inteira: a tela
    // degrada, não some.
    const lista = normalizeEditions([
      { id: 'e1', name: 'Primeira' },
      null,
      { name: 'Sem id' },
      'texto solto',
      { id: 'e2', name: 'Segunda' },
    ]);
    expect(lista.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('normalizeEdition', () => {
  it('recusa registro sem id, que viraria key de lista e alvo de rota', () => {
    expect(normalizeEdition({ name: 'Sem id' })).toBeNull();
    expect(normalizeEdition({ id: '', name: 'Id vazio' })).toBeNull();
    expect(normalizeEdition(null)).toBeNull();
  });

  it('aceita id numérico do Postgres como string', () => {
    expect(normalizeEdition({ id: 42, name: 'Núcleo' })?.id).toBe('42');
    expect(normalizeEdition({ id: 42, system_id: 7 })?.system_id).toBe('7');
  });

  it('completa campo ausente com valor neutro em vez de descartar o registro', () => {
    expect(normalizeEdition({ id: 'e1' })).toEqual({
      id: 'e1',
      name: '',
      system_id: '',
      slug: '',
      status: '',
      position: 0,
    });
  });

  it('rejeita position não-finita, que quebraria a ordenação', () => {
    expect(normalizeEdition({ id: 'e1', position: Number.NaN })?.position).toBe(0);
    expect(normalizeEdition({ id: 'e1', position: Infinity })?.position).toBe(0);
    expect(normalizeEdition({ id: 'e1', position: '3' })?.position).toBe(0);
    expect(normalizeEdition({ id: 'e1', position: 3 })?.position).toBe(3);
  });
});

describe('normalizeCategory', () => {
  it('distingue raiz de filha: parent_id ausente vira null, não string vazia', () => {
    // O filtro da árvore é `!c.parent_id` — string vazia funcionaria por acaso,
    // mas `null` é o que o tipo promete a quem lê depois.
    expect(normalizeCategory({ id: 'c1' })?.parent_id).toBeNull();
    expect(normalizeCategory({ id: 'c1', parent_id: null })?.parent_id).toBeNull();
    expect(normalizeCategory({ id: 'c1', parent_id: 'c0' })?.parent_id).toBe('c0');
  });
});

describe('normalizeComment', () => {
  it('só esconde o corpo quando deleted vier explicitamente true', () => {
    // Campo malformado não pode ocultar conteúdo legítimo do usuário.
    expect(normalizeComment({ id: 'k1', deleted: true })?.deleted).toBe(true);
    for (const naoApagado of [undefined, null, 0, '', 'false', 'true', 1]) {
      expect(normalizeComment({ id: 'k1', deleted: naoApagado })?.deleted).toBe(false);
    }
  });

  it('preserva o corpo e o autor quando vêm como texto', () => {
    expect(normalizeComment({
      id: 'k1',
      body: 'texto',
      author_name: 'Ana',
      created_at: '2026-08-13T10:00:00.000Z',
      user_id: 9,
    })).toEqual({
      id: 'k1',
      body: 'texto',
      author_name: 'Ana',
      created_at: '2026-08-13T10:00:00.000Z',
      deleted: false,
      user_id: '9',
    });
  });

  // Achado de review da PR #261: `asText` devolvia `''` para timestamp ausente,
  // e `''` chegava a `new Date('')` no render, imprimindo "Invalid Date".
  it('deixa created_at ausente em vez de virar string vazia ou data inválida', () => {
    for (const ruim of [undefined, null, '', 'ontem', 42, {}]) {
      expect(normalizeComment({ id: 'k1', created_at: ruim })?.created_at).toBeUndefined();
    }
  });
});

describe('formatarDataCurta', () => {
  it('formata timestamp válido e cai para traço no resto', () => {
    expect(formatarDataCurta('2026-08-13T10:00:00.000Z')).toBe(
      new Date('2026-08-13T10:00:00.000Z').toLocaleDateString('pt-BR'),
    );
    for (const ruim of [undefined, '', 'ontem']) {
      expect(formatarDataCurta(ruim)).toBe('—');
    }
  });
});

describe('normalizeVoteScore', () => {
  it('devolve null quando não há placar utilizável, para o chamador manter o anterior', () => {
    // Zerar a UI por causa de resposta malformada faz parecer que o termo
    // perdeu os votos.
    for (const hostil of [null, undefined, 'erro', 42, [], {}, { vote_score: null }, { vote_score: '5' }]) {
      expect(normalizeVoteScore(hostil)).toBeNull();
    }
    expect(normalizeVoteScore({ vote_score: Number.NaN })).toBeNull();
  });

  it('aceita placar numérico, inclusive zero e negativo', () => {
    expect(normalizeVoteScore({ vote_score: 0 })).toBe(0);
    expect(normalizeVoteScore({ vote_score: -3 })).toBe(-3);
    expect(normalizeVoteScore({ vote_score: 17 })).toBe(17);
  });
});

describe('normalizeSystem', () => {
  it('recusa registro sem id — o id vira system_id do termo criado', () => {
    expect(normalizeSystem({ name: 'Sem id' })).toBeNull();
  });
});
