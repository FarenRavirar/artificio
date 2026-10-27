// Spec 106 R3: troca de slug de mestre, unicidade contra `gm_profiles` E
// `gm_slug_redirects`, resolucao do redirect. Banco simulado por tabela: cada
// `selectFrom(tabela)` devolve a linha configurada, e as escritas ficam gravadas.
const { state, trx } = vi.hoisted(() => {
const state = {
  perfis: [] as Array<{ id: string; slug: string; user_id: string }>,
  redirects: [] as Array<{ old_slug: string; gm_id: string }>,
  writes: [] as Array<{ op: string; table: string; values?: unknown }>,
  audit: [] as unknown[],
};

function chain(table: string) {
  let wheres: Array<[string, string, unknown]> = [];
  const c: Record<string, unknown> = {};
  const rows = () => {
    const base = (table.startsWith('gm_profiles') ? state.perfis : state.redirects) as Array<Record<string, unknown>>;
    return base.filter((r) =>
      wheres.every(([col, op, v]) => {
        const key = col.split('.').pop() as string;
        if (op === 'in') return (v as unknown[]).includes(r[key]);
        return r[key] === v;
      }),
    );
  };
  const self = () => c;
  Object.assign(c, {
    select: self,
    innerJoin: self,
    forUpdate: self,
    where: (col: string, op: string, v: unknown) => {
      wheres = [...wheres, [col, op, v]];
      return c;
    },
    values: (values: unknown) => {
      state.writes.push({ op: 'insert', table, values });
      return c;
    },
    onConflict: self,
    set: (values: unknown) => {
      state.writes.push({ op: 'update', table, values });
      return c;
    },
    executeTakeFirst: async () => {
      const r = rows()[0];
      if (r && table.startsWith('gm_slug_redirects as r')) {
        const perfil = state.perfis.find((p) => p.id === r.gm_id);
        return perfil ? { slug: perfil.slug } : undefined;
      }
      return r;
    },
    execute: async () => {
      if (table === 'gm_slug_redirects' && wheres.length) state.writes.push({ op: 'delete', table });
      return rows();
    },
  });
  return c;
}

const trx = {
  selectFrom: (t: string) => chain(t),
  insertInto: (t: string) => chain(t),
  updateTable: (t: string) => chain(t),
  deleteFrom: (t: string) => chain(t),
};
return { state, trx };
});

vi.mock('../db/index.js', () => ({
  db: { ...trx, transaction: () => ({ execute: (cb: (t: typeof trx) => unknown) => cb(trx) }) },
}));
vi.mock('./identityAudit.js', () => ({
  auditIdentityChange: vi.fn(async (i: unknown) => void state.audit.push(['changed', i])),
  auditIdentityRejected: vi.fn(async (i: unknown) => void state.audit.push(['rejected', i])),
}));

import { GmSlugError, isGmSlugTaken, renameGmSlug, resolveGmSlugRedirect, takenGmSlugs } from './gmSlug.js';

beforeEach(() => {
  state.perfis = [
    { id: 'gm-1', slug: 'patorico027', user_id: 'u1' },
    { id: 'gm-2', slug: 'albert', user_id: 'u2' },
  ];
  state.redirects = [{ old_slug: 'antigo-do-2', gm_id: 'gm-2' }];
  state.writes = [];
  state.audit = [];
});

describe('isGmSlugTaken', () => {
  it('ocupado por perfil atual ou por slug antigo de outro mestre', async () => {
    expect(await isGmSlugTaken('albert')).toBe(true);
    expect(await isGmSlugTaken('antigo-do-2')).toBe(true);
    expect(await isGmSlugTaken('livre')).toBe(false);
  });

  it('o dono pode reaver o proprio slug antigo', async () => {
    expect(await isGmSlugTaken('antigo-do-2', undefined, 'gm-2')).toBe(false);
    expect(await isGmSlugTaken('antigo-do-2', undefined, 'gm-1')).toBe(true);
  });
});

describe('takenGmSlugs / resolveGmSlugRedirect', () => {
  it('une perfis e redirects', async () => {
    expect([...(await takenGmSlugs(['albert', 'antigo-do-2', 'livre']))].sort()).toEqual(['albert', 'antigo-do-2']);
  });

  it('slug antigo resolve para o slug ATUAL do dono; desconhecido e null', async () => {
    expect(await resolveGmSlugRedirect('antigo-do-2')).toBe('albert');
    expect(await resolveGmSlugRedirect('nada')).toBeNull();
  });
});

describe('renameGmSlug', () => {
  it('grava o redirect do slug antigo, troca o slug e audita', async () => {
    const r = await renameGmSlug({ gmId: 'gm-1', newSlug: 'void', actorId: 'admin', door: 'teste' });
    expect(r).toEqual({ from: 'patorico027', to: 'void' });
    expect(state.writes).toContainEqual({
      op: 'insert',
      table: 'gm_slug_redirects',
      values: { old_slug: 'patorico027', gm_id: 'gm-1' },
    });
    expect(state.writes.find((w) => w.op === 'update' && w.table === 'gm_profiles')?.values).toMatchObject({ slug: 'void' });
    expect(state.audit[0]).toEqual(['changed', expect.objectContaining({ field: 'slug', from: 'patorico027', to: 'void' })]);
  });

  it.each([['A'], ['com espaço'], ['MAIUSCULA'], ['a'], ['x'.repeat(41)]])('recusa formato %j, sem escrever', async (bad) => {
    await expect(renameGmSlug({ gmId: 'gm-1', newSlug: bad, actorId: 'a', door: 't' })).rejects.toMatchObject({ code: 'format' });
    expect(state.writes).toEqual([]);
    expect(state.audit[0]).toEqual(['rejected', expect.objectContaining({ field: 'slug', reason: 'format' })]);
  });

  it('recusa slug de outro perfil e slug antigo de outro perfil, sem escrever', async () => {
    for (const taken of ['albert', 'antigo-do-2']) {
      await expect(renameGmSlug({ gmId: 'gm-1', newSlug: taken, actorId: 'a', door: 't' })).rejects.toBeInstanceOf(GmSlugError);
    }
    expect(state.writes).toEqual([]);
    expect(state.audit.map((a) => (a as [string, { reason: string }])[1].reason)).toEqual(['taken', 'taken']);
    // A recusa aponta o perfil afetado (e o dono dele), nao o ator.
    expect(state.audit[0]).toEqual(['rejected', expect.objectContaining({ entityId: 'gm-1', targetUserId: 'u1' })]);
  });

  it('perfil inexistente e slug igual ao atual nao escrevem', async () => {
    await expect(renameGmSlug({ gmId: 'nope', newSlug: 'novo', actorId: 'a', door: 't' })).rejects.toMatchObject({ code: 'not_found' });
    expect(state.audit[0]).toEqual(['rejected', expect.objectContaining({ entityId: 'nope', targetUserId: null })]);
    await expect(renameGmSlug({ gmId: 'gm-1', newSlug: 'patorico027', actorId: 'a', door: 't' })).rejects.toMatchObject({ code: 'same' });
    expect(state.writes).toEqual([]);
  });
});
