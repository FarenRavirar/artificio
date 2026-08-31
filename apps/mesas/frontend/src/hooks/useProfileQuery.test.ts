import { beforeEach, describe, expect, it } from 'vitest';
import {
  deriveGmSlug,
  lerSnapshotGm,
  limparSnapshotGm,
  marcarGmExistente,
} from './useProfileQuery';

/**
 * O POST /api/v1/gm/profile rejeita slug fora de `/^[a-z0-9-]+$/` com 400
 * (gmPanel.ts). Este teste fixa o contrato do cliente: a derivação nunca
 * entrega slug que o backend recusaria.
 *
 * `deriveGmSlug` vive neste módulo desde a consolidação do editor (spec 099,
 * pós-B5): o único consumidor é o `useUpdateGm` daqui — antes vivia em
 * `utils/gmSlug.ts`.
 */

const SLUG_REGEX = /^[a-z0-9-]+$/;

describe('deriveGmSlug', () => {
  it('usa username como base e sanitiza underscore', () => {
    expect(deriveGmSlug({ id: 'u1', username: 'mestre_lobo' })).toBe('mestre-lobo');
  });

  it('sanitiza email com ponto e + quando não há username', () => {
    expect(
      deriveGmSlug({ id: 'u1', username: null, email: 'joao.silva+mesas@gmail.com' }),
    ).toBe('joao-silva-mesas');
  });

  it('resultado sempre casa com o regex do POST', () => {
    const casos = [
      { id: 'u1', username: 'MESTRE_Caçador!' },
      { id: 'u1', username: null, email: 'A.B+C@x.com' },
      { id: 'u1' },
      { id: 'u1', username: '___' },
      { id: 'u1', username: ' João ' },
    ];
    for (const user of casos) {
      expect(deriveGmSlug(user)).toMatch(SLUG_REGEX);
    }
  });

  it('fallback user-<id 8> quando username e email ausentes', () => {
    expect(deriveGmSlug({ id: 'abcdefgh1234' })).toBe('user-abcdefgh');
  });

  it('fallback quando email não tem parte local', () => {
    expect(deriveGmSlug({ id: 'abcdefgh', username: null, email: '@x.com' })).toBe(
      'user-abcdefgh',
    );
  });

  it('nunca devolve slug vazio', () => {
    expect(deriveGmSlug({ id: '', username: null, email: undefined })).toBe('user-');
  });
});

/**
 * Snapshot que decide POST vs PUT (achado de review, PR #297).
 *
 * O caminho de mestre novo (`gm: null`) so e alcancavel se o snapshot for
 * tirado ANTES de qualquer escrita otimista — sao duas, e as duas preenchem
 * `gm`: a do `updateGm` no enqueue (500ms antes) e a do `onMutate`. Estes
 * testes cobrem a regra de idempotencia que garante isso.
 */
describe('marcarGmExistente / limparSnapshotGm', () => {
  beforeEach(() => limparSnapshotGm());

  it('primeira marcacao vence — escrita otimista posterior NAO reescreve', () => {
    marcarGmExistente(false);   // contexto, antes do optimistic update
    marcarGmExistente(true);    // onMutate, ja com o cache preenchido
    expect(lerSnapshotGm()).toBe(false);
  });

  it('sem contexto, o onMutate ainda marca (chamada direta da mutation)', () => {
    marcarGmExistente(true);
    expect(lerSnapshotGm()).toBe(true);
  });

  it('limpar fecha o ciclo: a proxima edicao volta a medir', () => {
    marcarGmExistente(false);
    limparSnapshotGm();
    marcarGmExistente(true);
    expect(lerSnapshotGm()).toBe(true);
  });
});