import { beforeEach, describe, expect, it } from 'vitest';
import {
  lerSnapshotGm,
  limparSnapshotGm,
  marcarGmExistente,
} from './useProfileQuery';

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