import { describe, expect, it, vi } from 'vitest';
import {
  deriveScope,
  lookupLearningRules,
  nextRuleState,
  recordLearningRulesFromCorrections,
  recordSystemEntityRule,
  recordEntityHintRule,
  recordLabelAliasFromCorrection,
  loadActiveLabelAliases,
} from '../learningRules.js';

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
  it('não grava mais regra legada system_name -> system_name', async () => {
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
        { field: 'slots_total', inputValue: 4, outputValue: 5 },
        { field: 'price_value', inputValue: 30, outputValue: 40 },
        { field: 'day_of_week', inputValue: 'sexta', outputValue: 'sábado' },
        { field: 'contact_url', inputValue: 'https://a.test', outputValue: 'https://b.test' },
      ],
      { guild_id: 'guild-1' },
      'user-1',
      { insertInto } as never,
    );

    expect(insertInto).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it('não generaliza fatos de uma mesa como regra de valor para outra', async () => {
    const insertInto = vi.fn();

    await recordLearningRulesFromCorrections(
      [
        { field: 'slots_total', inputValue: 4, outputValue: 5 },
        { field: 'price_value', inputValue: 30, outputValue: 40 },
        { field: 'start_time', inputValue: '20:00', outputValue: '21:00' },
        { field: 'title', inputValue: 'Mesa A', outputValue: 'Mesa B' },
      ],
      { guild_id: 'guild-1', channel_id: 'channel-1', author_id: 'author-1' },
      'user-1',
      { insertInto } as never,
    );

    expect(insertInto).not.toHaveBeenCalled();
  });
});

describe('recordSystemEntityRule', () => {
  it('aprende token bruto para entidade estável, não nome canônico errado', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const onConflict = vi.fn().mockReturnValue({ execute });
    const values = vi.fn().mockReturnValue({ onConflict });
    const insertInto = vi.fn().mockReturnValue({ values });

    await recordSystemEntityRule({
      sourceHint: 'D&D 5e da casa',
      systemId: 'dnd-5e',
      systemName: 'D&D 5e',
      scope: { guild_id: 'guild-1' },
      userId: 'user-1',
    }, { insertInto } as never);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      field: 'system_entity',
      input_token: 'd&d 5e da casa',
      scope_type: 'guild',
      source: 'human',
    }));
  });

  it('propaga erro no modo transacional estrito da outbox', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('db down'));
    const onConflict = vi.fn().mockReturnValue({ execute });
    const values = vi.fn().mockReturnValue({ onConflict });
    const insertInto = vi.fn().mockReturnValue({ values });

    await expect(recordSystemEntityRule({
      sourceHint: 'D&D 5e', systemId: 'dnd-5e', systemName: 'D&D 5e',
      scope: null, userId: 'user-1',
    }, { insertInto } as never, { throwOnError: true })).rejects.toThrow('db down');
  });
});

describe('recordEntityHintRule (achado do mantenedor 2026-07-17, IMPERATIVO: generalização do learning de entidade além de system_entity)', () => {
  it('aprende hint bruto de VTT ("roll 20") para o id do catálogo, igual system_entity já fazia', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const onConflict = vi.fn().mockReturnValue({ execute });
    const values = vi.fn().mockReturnValue({ onConflict });
    const insertInto = vi.fn().mockReturnValue({ values });

    await recordEntityHintRule({
      field: 'vtt_entity',
      sourceHint: 'Discord e Roll 20 (necessário PC)',
      outputValue: { vtt_platform_id: 'roll20' },
      scope: { guild_id: 'guild-1' },
      userId: 'user-1',
    }, { insertInto } as never);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      field: 'vtt_entity',
      input_token: 'discord e roll 20 (necessario pc)',
      scope_type: 'guild',
      source: 'human',
    }));
  });

  it('não grava regra sem hint de entrada (sem texto isolado pra aprender)', async () => {
    const insertInto = vi.fn();

    await recordEntityHintRule({
      field: 'vtt_entity',
      sourceHint: null,
      outputValue: { vtt_platform_id: 'roll20' },
      scope: null,
      userId: 'user-1',
    }, { insertInto } as never);

    expect(insertInto).not.toHaveBeenCalled();
  });

  it('não grava regra sem valor de saída válido (correção limpou o campo, não ensina nada)', async () => {
    const insertInto = vi.fn();

    await recordEntityHintRule({
      field: 'vtt_entity',
      sourceHint: 'Roll 20',
      outputValue: { vtt_platform_id: null },
      scope: null,
      userId: 'user-1',
    }, { insertInto } as never);

    expect(insertInto).not.toHaveBeenCalled();
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
  it('ignora regras legadas de valor para fatos específicos do anúncio', async () => {
    const selectFrom = vi.fn();

    const result = await lookupLearningRules(
      [
        { field: 'slots_total', value: 4 },
        { field: 'price_value', value: 30 },
        { field: 'day_of_week', value: 'sexta' },
      ],
      { guild_id: 'guild-1' },
      { selectFrom } as never,
    );

    expect(result).toEqual({ hits: [], conflicts: [] });
    expect(selectFrom).not.toHaveBeenCalled();
  });

  it('consulta vtt_entity e age_rating (achado do mantenedor 2026-07-17: campos de catálogo/enum agora aprendem, generalização de FIELD_VALUE_RULE_FIELDS)', async () => {
    const rows = [{ id: 'r1', output_value: { vtt_platform_id: 'roll20' }, confidence: 0.9, scope_type: 'guild' }];
    const selectBuilder: SelectBuilderMock = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(rows),
    };
    const selectFrom = vi.fn().mockReturnValue(selectBuilder);
    const conn = { selectFrom } as never;

    const result = await lookupLearningRules(
      [{ field: 'vtt_entity', value: 'roll 20' }],
      { guild_id: 'guild-1' },
      conn,
    );

    expect(selectFrom).toHaveBeenCalledWith('discord_learning_rules');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ field: 'vtt_entity', value: { vtt_platform_id: 'roll20' } });
  });

  it('ignora hit legado system_name mesmo se estiver ativo', async () => {
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
    expect(result.hits).toEqual([]);
  });

  it('ignora conflito legado system_name porque o contrato foi aposentado', async () => {
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
    expect(result.conflicts).toEqual([]);
  });

  it('retorna entidade de sistema ativa pelo token bruto exato', async () => {
    const rows = [{
      id: 'entity-1',
      output_value: { system_id: 'dnd-5e', system_name: 'D&D 5e' },
      confidence: 0.91,
      scope_type: 'guild',
    }];
    const selectBuilder: SelectBuilderMock = {
      select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(rows),
    };
    const conn = { selectFrom: vi.fn().mockReturnValue(selectBuilder) } as never;

    const result = await lookupLearningRules(
      [{ field: 'system_entity', value: 'D&D 5e da casa' }],
      { guild_id: 'guild-1' },
      conn,
    );

    expect(result.hits).toEqual([expect.objectContaining({
      ruleId: 'entity-1',
      field: 'system_entity',
      value: { system_id: 'dnd-5e', system_name: 'D&D 5e' },
    })]);
  });
});
