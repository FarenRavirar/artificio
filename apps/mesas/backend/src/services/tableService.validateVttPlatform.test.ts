import { beforeEach, describe, expect, it, vi } from 'vitest';

// `validateVttPlatform` escolhe as colunas pela forma do valor: sem forma de
// UUID consulta só `slug` (comparar texto livre com a coluna `uuid` faria o
// Postgres lançar); com forma de UUID consulta `id` OU `slug`. O mock resolve o
// callback do `where` num descritor para provar a escolha.
const { whereCalls, executeTakeFirst } = vi.hoisted(() => ({
  whereCalls: [] as unknown[][],
  executeTakeFirst: vi.fn(),
}));

vi.mock('../db/index.js', () => {
  const builder = {
    select: () => builder,
    where: (...args: unknown[]) => {
      if (typeof args[0] === 'function') {
        const eb = Object.assign(
          (col: string, op: string, val: unknown) => [col, op, val],
          { or: (parts: unknown[]) => ({ or: parts }) },
        );
        whereCalls.push([(args[0] as (e: typeof eb) => unknown)(eb)]);
      } else {
        whereCalls.push(args);
      }
      return builder;
    },
    orderBy: () => builder,
    executeTakeFirst,
  };
  return { db: { selectFrom: () => builder } };
});

import { TableService } from './tableService.js';

const FOUNDRY_ID = '1849fd85-2998-4aeb-a9fc-13dd06a7cbe9';

describe('TableService.validateVttPlatform', () => {
  beforeEach(() => {
    whereCalls.length = 0;
    executeTakeFirst.mockReset();
  });

  it('vazio ou custom não consulta o banco', async () => {
    await expect(TableService.validateVttPlatform(null)).resolves.toBeNull();
    await expect(TableService.validateVttPlatform('custom')).resolves.toBeNull();
    expect(executeTakeFirst).not.toHaveBeenCalled();
  });

  it('slug resolve pela coluna slug', async () => {
    executeTakeFirst.mockResolvedValueOnce({ id: FOUNDRY_ID });
    await expect(TableService.validateVttPlatform('foundry-vtt')).resolves.toBe(FOUNDRY_ID);
    expect(whereCalls[0]).toEqual([['slug', '=', 'foundry-vtt']]);
  });

  // Incidente 2026-10-05..09: a herança do perfil mandava o UUID de
  // `preferred_vtt_platforms` e o backend só procurava por slug — 400
  // "Plataforma VTT inválida" para quem publicava sem abrir a parte "Onde".
  // Consulta `id` OU `slug`: um slug que por acaso tivesse forma de UUID
  // continua resolvendo (ressalva do CodeRabbit na PR #336).
  it('UUID herdado do perfil resolve por id ou slug', async () => {
    executeTakeFirst.mockResolvedValueOnce({ id: FOUNDRY_ID });
    await expect(TableService.validateVttPlatform(FOUNDRY_ID)).resolves.toBe(FOUNDRY_ID);
    expect(whereCalls[0]).toEqual([
      { or: [['id', '=', FOUNDRY_ID], ['slug', '=', FOUNDRY_ID]] },
    ]);
  });

  it('plataforma inexistente ou inativa continua sendo 400', async () => {
    executeTakeFirst.mockResolvedValueOnce(undefined);
    await expect(TableService.validateVttPlatform('nao-existe')).rejects.toThrow('Plataforma VTT inválida');
  });
});
