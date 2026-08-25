import { describe, it, expect } from 'vitest';
import {
  IMPLIES_COLUMNS,
  validateImpliesInput,
  impliesInsertValues,
  applyImpliesUpdate,
} from './platformUtils.js';

/**
 * Achado Sonar (PR #287): a validação dos requisitos implicados estava
 * duplicada byte-a-byte nas duas rotas de catálogo. Ao subir para util
 * compartilhado, a lógica passou a governar VTT e comunicação ao mesmo tempo —
 * daí a suíte, que antes não existia neste arquivo.
 */

describe('IMPLIES_COLUMNS', () => {
  it('cobre as três colunas da migration_162', () => {
    expect(IMPLIES_COLUMNS).toEqual([
      'implies_pc',
      'implies_microphone',
      'implies_camera',
    ]);
  });
});

describe('validateImpliesInput', () => {
  it('aceita corpo sem nenhum flag (PUT parcial)', () => {
    expect(validateImpliesInput({})).toBeNull();
  });

  it('aceita os três flags como boolean', () => {
    expect(validateImpliesInput({
      implies_pc: true,
      implies_microphone: false,
      implies_camera: true,
    })).toBeNull();
  });

  it.each([
    ['implies_pc', { implies_pc: 'true' }],
    ['implies_microphone', { implies_microphone: 1 }],
    ['implies_camera', { implies_camera: null }],
  ])('rejeita %s com tipo errado, nomeando a coluna', (column, payload) => {
    expect(validateImpliesInput(payload)).toBe(`${column} deve ser boolean.`);
  });

  it('devolve o erro do primeiro flag inválido, na ordem das colunas', () => {
    expect(validateImpliesInput({
      implies_microphone: 'sim',
      implies_camera: 'não',
    })).toBe('implies_microphone deve ser boolean.');
  });
});

describe('impliesInsertValues', () => {
  it('preenche com false o flag ausente — mesmo default da coluna', () => {
    expect(impliesInsertValues({ implies_pc: true })).toEqual({
      implies_pc: true,
      implies_microphone: false,
      implies_camera: false,
    });
  });

  it('devolve sempre as três colunas, mesmo com corpo vazio', () => {
    expect(impliesInsertValues({})).toEqual({
      implies_pc: false,
      implies_microphone: false,
      implies_camera: false,
    });
  });
});

describe('applyImpliesUpdate', () => {
  it('não toca no updateData quando nenhum flag vem no corpo', () => {
    const updateData: Record<string, unknown> = { name: 'Roll20' };
    applyImpliesUpdate({}, updateData);
    expect(updateData).toEqual({ name: 'Roll20' });
  });

  it('acrescenta só os flags definidos, preservando o PUT parcial', () => {
    // handleToggleActive envia só is_active — não pode zerar os requisitos
    // como efeito colateral.
    const updateData: Record<string, unknown> = { is_active: false };
    applyImpliesUpdate({ implies_camera: true }, updateData);
    expect(updateData).toEqual({ is_active: false, implies_camera: true });
  });

  it('permite desmarcar explicitamente com false', () => {
    const updateData: Record<string, unknown> = {};
    applyImpliesUpdate({ implies_pc: false }, updateData);
    expect(updateData).toEqual({ implies_pc: false });
  });
});
