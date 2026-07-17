import { describe, it, expect, vi } from 'vitest';
import { normalizeToken, lookupFieldLearning, recordFieldLearning } from '../fieldLearning.js';

describe('normalizeToken', () => {
  it('minúscula, tira acento, colapsa espaços', () => {
    expect(normalizeToken('  D&D   5E ')).toBe('d&d 5e');
    expect(normalizeToken('Tormenta20')).toBe('tormenta20');
    expect(normalizeToken('SÁBADO')).toBe('sabado');
    expect(normalizeToken('Não-sei')).toBe('nao-sei');
  });

  it('coage não-string', () => {
    expect(normalizeToken(5)).toBe('5');
  });

  it('null/undefined/vazio → null', () => {
    expect(normalizeToken(null)).toBeNull();
    expect(normalizeToken(undefined)).toBeNull();
    expect(normalizeToken('   ')).toBeNull();
  });
});

// conn fake p/ lookup: select-chain devolve `row`; update-chain registra uso.
interface SelectBuilderMock {
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
}

interface UpdateBuilderMock {
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

function makeLookupConn(row: { id: string; output_value: unknown } | undefined) {
  const selectBuilder: SelectBuilderMock = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(row),
  };
  const updateExec = vi.fn().mockResolvedValue(undefined);
  const updateBuilder: UpdateBuilderMock = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockReturnValue({ catch: () => updateExec() }),
  };
  const selectFrom = vi.fn().mockReturnValue(selectBuilder);
  const updateTable = vi.fn().mockReturnValue(updateBuilder);
  return { conn: { selectFrom, updateTable } as never, selectFrom, updateTable };
}

describe('lookupFieldLearning', () => {
  it('ignora tokens nulos e campos não-aprendíveis (sem query)', async () => {
    const { conn, selectFrom } = makeLookupConn(undefined);
    const hits = await lookupFieldLearning(
      [
        { field: 'system_name', value: null },
        { field: 'campo_inexistente', value: 'x' },
      ],
      'guild-1',
      'value',
      conn,
    );
    expect(hits).toEqual([]);
    expect(selectFrom).not.toHaveBeenCalled();
  });

  it('retorna cache hit e marca uso (applied_count)', async () => {
    const { conn, updateTable } = makeLookupConn({ id: 'r1', output_value: 'D&D 5.2' });
    const hits = await lookupFieldLearning([{ field: 'system_name', value: 'd&d 5e' }], 'guild-1', 'value', conn);
    expect(hits).toEqual([{ field: 'system_name', value: 'D&D 5.2' }]);
    expect(updateTable).toHaveBeenCalledWith('discord_field_learning');
  });

  it('erro de DB → vazio (best-effort, cai pra IA)', async () => {
    const conn = {
      selectFrom: () => {
        throw new Error('db down');
      },
    } as never;
    const hits = await lookupFieldLearning([{ field: 'system_name', value: 'x' }], null, 'value', conn);
    expect(hits).toEqual([]);
  });
});

describe('recordFieldLearning', () => {
  it('faz upsert só de campos aprendíveis com token e valor válidos', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const onConflict = vi.fn().mockReturnValue({ execute });
    const values = vi.fn().mockReturnValue({ onConflict });
    const insertInto = vi.fn().mockReturnValue({ values });
    const conn = { insertInto } as never;

    await recordFieldLearning(
      [
        { field: 'system_name', inputValue: 'd&d 5e', outputValue: 'D&D 5.2' }, // ok
        { field: 'campo_x', inputValue: 'a', outputValue: 'b' }, // não-aprendível
        { field: 'title', inputValue: null, outputValue: 'X' }, // sem token de entrada
        { field: 'description', inputValue: 'y', outputValue: '' }, // saída vazia
      ],
      'guild-1',
      'user-1',
      conn,
    );

    expect(insertInto).toHaveBeenCalledTimes(1);
    expect(insertInto).toHaveBeenCalledWith('discord_field_learning');
    // guild_id e key_type entram no values
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ guild_id: 'guild-1', key_type: 'value', field: 'system_name' }));
  });
});
