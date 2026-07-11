import { describe, expect, it, vi } from 'vitest';
import {
  deriveScope,
  lookupLearningRules,
  nextRuleState,
  recordLearningRulesFromCorrections,
  recordLabelAliasFromCorrection,
  loadActiveLabelAliases,
} from '../learningRules';

interface SelectBuilderMock {
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy?: ReturnType<typeof vi.fn>;
  limit?: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

describe('deriveScope', () => {
  it('gera escopo estavel global, guild e composite', () => {
    const global = deriveScope(null);
    const guild = deriveScope({ guild_id: 'guild-1' });
    const composite = deriveScope({ guild_id: 'guild-1', channel_id: 'channel-1' });

    expect(global.scopeType).toBe('global');
    expect(global.scopeJson).toEqual({});
    expect(guild.scopeType).toBe('guild');
    expect(guild.scopeJson).toEqual({ guild_id: 'guild-1' });
    expect(composite.scopeType).toBe('composite');
    expect(composite.scopeJson).toEqual({ channel_id: 'channel-1', guild_id: 'guild-1' });
    expect(guild.scopeHash).toHaveLength(64);
  });
});

describe('nextRuleState', () => {
  it('ativa regra com confirmacoes e suprime quando valor muda', () => {
    expect(nextRuleState({ hits: 1, rejections: 0, outputChanged: false }).status).toBe('active');
    expect(nextRuleState({ hits: 3, rejections: 0, outputChanged: true }).status).toBe('suppressed');
    expect(nextRuleState({ hits: 1, rejections: 2, outputChanged: false }).status).toBe('suppressed');
  });
});

describe('recordLearningRulesFromCorrections', () => {
  it('faz upsert apenas de campo aprendivel com token e saida', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const onConflict = vi.fn().mockReturnValue({ execute });
    const values = vi.fn().mockReturnValue({ onConflict });
    const insertInto = vi.fn().mockReturnValue({ values });

    await recordLearningRulesFromCorrections(
      [
        { field: 'system_name', inputValue: 'd&d 5e', outputValue: 'D&D 5.2' },
        { field: 'campo_x', inputValue: 'a', outputValue: 'b' },
        { field: 'title', inputValue: null, outputValue: 'Mesa' },
        { field: 'price_type', inputValue: 'pago', outputValue: '' },
      ],
      { guild_id: 'guild-1' },
      'user-1',
      { insertInto } as never,
    );

    expect(insertInto).toHaveBeenCalledTimes(1);
    expect(insertInto).toHaveBeenCalledWith('discord_learning_rules');
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      rule_type: 'field_value',
      field: 'system_name',
      input_token: 'd&d 5e',
      scope_type: 'guild',
      source: 'human',
    }));
  });
});

describe('recordLabelAliasFromCorrection (DEB-052-02)', () => {
  it('aprende rotulo desconhecido quando campo estava vazio e valor bate com linha do raw_text', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const onConflict = vi.fn().mockReturnValue({ execute });
    const values = vi.fn().mockReturnValue({ onConflict });
    const insertInto = vi.fn().mockReturnValue({ values });

    await recordLabelAliasFromCorrection(
      [{ field: 'system_name', inputValue: null, outputValue: 'Vampiro: A Máscara' }],
      'Sistema Utilizado: Vampiro: A Máscara\nVagas: 3',
      { guild_id: 'guild-1' },
      'user-1',
      { insertInto } as never,
    );

    expect(insertInto).toHaveBeenCalledWith('discord_learning_rules');
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      rule_type: 'label_alias',
      field: 'system_name',
      input_token: 'sistema utilizado',
      source: 'human',
    }));
  });

  it('nao aprende quando o campo ja tinha valor extraido (troca de valor, nao rotulo novo)', async () => {
    const insertInto = vi.fn();

    await recordLabelAliasFromCorrection(
      [{ field: 'system_name', inputValue: 'D&D 5e', outputValue: 'D&D 5.2' }],
      'Sistema: D&D 5e',
      { guild_id: 'guild-1' },
      'user-1',
      { insertInto } as never,
    );

    expect(insertInto).not.toHaveBeenCalled();
  });

  it('nao aprende quando nenhuma linha do raw_text bate com o valor corrigido', async () => {
    const insertInto = vi.fn();

    await recordLabelAliasFromCorrection(
      [{ field: 'system_name', inputValue: null, outputValue: 'Vampiro: A Máscara' }],
      'Vagas: 3\nHorário: 20h',
      { guild_id: 'guild-1' },
      'user-1',
      { insertInto } as never,
    );

    expect(insertInto).not.toHaveBeenCalled();
  });
});

describe('loadActiveLabelAliases', () => {
  it('agrupa rotulos ativos por campo, ignorando abaixo do limiar de confianca', async () => {
    const rows = [
      { field: 'system_name', input_token: 'sistema utilizado' },
      { field: 'system_name', input_token: 'jogo do dia' },
      { field: 'title', input_token: 'nome da aventura' },
    ];
    const selectBuilder: SelectBuilderMock = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(rows),
    };
    const conn = { selectFrom: vi.fn().mockReturnValue(selectBuilder) } as never;

    const result = await loadActiveLabelAliases({ guild_id: 'guild-1' }, conn);

    expect(result).toEqual({
      system_name: ['sistema utilizado', 'jogo do dia'],
      title: ['nome da aventura'],
    });
  });

  it('erro de DB retorna vazio (best-effort)', async () => {
    const conn = { selectFrom: vi.fn().mockImplementation(() => { throw new Error('db down'); }) } as never;
    const result = await loadActiveLabelAliases(null, conn);
    expect(result).toEqual({});
  });
});

describe('lookupLearningRules', () => {
  it('retorna hit ativo e separa conflito de valores divergentes', async () => {
    const rows = [
      { id: 'r1', output_value: 'D&D 5.2', confidence: 0.9, scope_type: 'guild' },
      { id: 'r2', output_value: 'D&D 5.2', confidence: 0.85, scope_type: 'global' },
    ];
    const selectBuilder: SelectBuilderMock = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(rows),
    };
    const conn = { selectFrom: vi.fn().mockReturnValue(selectBuilder) } as never;

    const result = await lookupLearningRules([{ field: 'system_name', value: 'D&D 5e' }], { guild_id: 'guild-1' }, conn);

    expect(result.conflicts).toEqual([]);
    expect(result.hits).toEqual([expect.objectContaining({ ruleId: 'r1', field: 'system_name', value: 'D&D 5.2' })]);
  });

  it('bloqueia aplicacao quando ha conflito', async () => {
    const rows = [
      { id: 'r1', output_value: 'D&D 5.2', confidence: 0.9, scope_type: 'guild' },
      { id: 'r2', output_value: 'Pathfinder 2e', confidence: 0.88, scope_type: 'global' },
    ];
    const selectBuilder: SelectBuilderMock = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(rows),
    };
    const conn = { selectFrom: vi.fn().mockReturnValue(selectBuilder) } as never;

    const result = await lookupLearningRules([{ field: 'system_name', value: 'D&D 5e' }], { guild_id: 'guild-1' }, conn);

    expect(result.hits).toEqual([]);
    expect(result.conflicts).toEqual([expect.objectContaining({ field: 'system_name', ruleIds: ['r1', 'r2'] })]);
  });
});
