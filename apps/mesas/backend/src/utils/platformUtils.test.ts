import { describe, it, expect } from 'vitest';
import {
  IMPLIES_COLUMNS,
  CATALOGO_VTT,
  CATALOGO_COMUNICACAO,
  aliasConflictMessage,
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

describe('catálogos (achado Sonar, PR #307: 96% de duplicação entre as rotas)', () => {
  // O que separava os dois arquivos era só o NOME de tabela/coluna. Estes
  // testes travam esses nomes: errar um deles produz SQL que compila e falha
  // em runtime, porque as guardas montam a query por `sql.ref`.
  it('VTT aponta para as tabelas e a coluna de perfil do catálogo de VTT', () => {
    expect(CATALOGO_VTT).toEqual({
      aliases: 'vtt_platform_aliases',
      plataformas: 'vtt_platforms',
      fk: 'vtt_platform_id',
      colunaPerfil: 'preferred_vtt_platforms',
    });
  });

  it('comunicação aponta para as suas', () => {
    expect(CATALOGO_COMUNICACAO).toEqual({
      aliases: 'communication_platform_aliases',
      plataformas: 'communication_platforms',
      fk: 'communication_platform_id',
      colunaPerfil: 'preferred_communication_platforms',
    });
  });

  it('os dois catálogos não compartilham nenhum nome — troca silenciosa não passa', () => {
    const vtt = Object.values(CATALOGO_VTT);
    const com = Object.values(CATALOGO_COMUNICACAO);
    expect(vtt.filter((v) => com.includes(v))).toEqual([]);
  });
});

describe('aliasConflictMessage', () => {
  // A duplicata real que originou a guarda: `Meet` foi criada como plataforma
  // embora "Meet" já fosse apelido de `Google Meet` desde a migration_159
  // (medido em beta, 2026-09-04).
  it('nomeia a plataforma dona do apelido, não só recusa', () => {
    const msg = aliasConflictMessage('Meet', 'Google Meet');
    expect(msg).toContain('"Meet"');
    expect(msg).toContain('"Google Meet"');
  });

  it('diz ao admin o que fazer em vez de criar', () => {
    // Recusa sem saída deixa o admin sem ação possível: ele não sabe que a
    // plataforma já existe sob outro nome.
    expect(aliasConflictMessage('Meet', 'Google Meet')).toMatch(/Use essa plataforma/);
  });
});
