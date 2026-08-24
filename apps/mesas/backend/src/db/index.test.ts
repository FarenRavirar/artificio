// `getDb()` exige DATABASE_URL valida (DT-004). O Pool do `pg` so abre socket
// no primeiro query, entao uma URL sintetica basta para exercitar o Proxy.
process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:5432/test';

const { db } = await import('./index.js');

/**
 * Regressao: o Proxy lazy de `db` bindava TODO valor do tipo `function` ao
 * instance. `db.fn` do Kysely e um objeto *callable* com metodos anexados
 * (`count`, `sum`, `countAll`, ...), e `Function.prototype.bind` descarta
 * essas own properties. Efeito medido em producao: todo
 * `POST /api/v1/profile/links` respondia 500 com
 * `TypeError: db.fn.count is not a function`, e o painel do mestre exibia
 * "Erro ao adicionar link. Verifique a URL" para um bug de servidor.
 */
describe('db proxy — modulos callable do Kysely', () => {
  it('preserva os metodos anexados de db.fn', () => {
    expect(typeof db.fn).toBe('function');
    expect(typeof db.fn.count).toBe('function');
    expect(typeof db.fn.countAll).toBe('function');
    expect(typeof db.fn.sum).toBe('function');
    expect(typeof db.fn.max).toBe('function');
    expect(typeof db.fn.min).toBe('function');
    expect(typeof db.fn.avg).toBe('function');
    expect(typeof db.fn.coalesce).toBe('function');
  });

  it('db.fn.count monta a expressao de agregacao sem lancar', () => {
    expect(() => db.fn.count<number>('id').as('count')).not.toThrow();
  });
});
