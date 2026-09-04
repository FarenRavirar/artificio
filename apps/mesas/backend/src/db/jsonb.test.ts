import { describe, it, expect } from 'vitest';
import { toJsonbParam, toJsonbParamNotNull } from './jsonb.js';

describe('toJsonbParam', () => {
  it('serializa objeto e array — o que o driver `pg` NÃO faz sozinho', () => {
    expect(toJsonbParam({ x: 1 })).toBe('{"x":1}');
    expect(toJsonbParam([{ title: 'a' }])).toBe('[{"title":"a"}]');
  });

  it('preserva os três estados do contrato das rotas', () => {
    expect(toJsonbParam(undefined)).toBeUndefined(); // não mexe na coluna
    expect(toJsonbParam(null)).toBeNull(); // zera a coluna
    expect(toJsonbParam({ a: 1 })).toBe('{"a":1}'); // grava
  });

  it('o resultado é JSON que o Postgres aceita — array cru não seria', () => {
    const serializado = toJsonbParam([{ icon: 'clock', title: 'Pontual' }]);
    expect(() => JSON.parse(serializado as string)).not.toThrow();
    // O caminho antigo entregava o array JS ao driver, que produzia o literal
    // de array do Postgres (`{"{...}"}`) e estourava `22P02`.
    expect(serializado).not.toMatch(/^\{"\{/);
  });
});

describe('toJsonbParamNotNull', () => {
  it('não emite null: a coluna é NOT NULL DEFAULT \'[]\'', () => {
    expect(toJsonbParamNotNull(undefined)).toBeUndefined();
    expect(toJsonbParamNotNull([])).toBe('[]');
    expect(toJsonbParamNotNull([{ channel: 'discord' }])).toBe('[{"channel":"discord"}]');
  });
});
