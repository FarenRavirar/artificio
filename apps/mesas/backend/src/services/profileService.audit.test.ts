// Spec 106 R8 (achado de review, PR #342): a auditoria de nome grava o valor que A
// CHAMADA gravou, lido o anterior sob FOR UPDATE e dentro da mesma transacao. Antes,
// reler a linha depois da escrita registrava o valor da outra requisicao.
const h = vi.hoisted(() => {
  const audit: Array<{ input: Record<string, unknown>; trx: unknown }> = [];
  const forUpdate = vi.fn();
  const trx: Record<string, unknown> = {};
  let anterior: { id: string; display_name: string } | undefined;
  const chain = () => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'where', 'set', 'values', 'returning']) c[m] = () => c;
    c.forUpdate = () => {
      forUpdate();
      return c;
    };
    c.executeTakeFirst = async () => anterior;
    c.execute = async () => [];
    return c;
  };
  Object.assign(trx, { selectFrom: chain, updateTable: chain, insertInto: chain });
  return { audit, forUpdate, trx, setAnterior: (a: typeof anterior) => void (anterior = a) };
});

vi.mock('../db/index.js', () => ({
  db: {
    ...h.trx,
    transaction: () => ({ execute: (cb: (t: unknown) => unknown) => cb(h.trx) }),
    selectFrom: vi.fn(() => ({
      select: () => ({ where: () => ({ executeTakeFirst: async () => ({ display_name: 'depois-relido' }) }) }),
    })),
  },
}));
vi.mock('./identityAudit.js', () => ({
  auditIdentityChange: vi.fn(async (input: Record<string, unknown>, trx: unknown) => void h.audit.push({ input, trx })),
}));

import { db } from '../db/index.js';
import { prepareNewGmProfileIdentity, updateProfile } from './profileService.js';

describe('updateProfile — auditoria de display_name', () => {
  beforeEach(() => {
    h.audit.length = 0;
    h.forUpdate.mockClear();
  });

  it('audita o valor gravado por esta chamada, na transacao, com a linha travada', async () => {
    h.setAnterior({ id: 'p1', display_name: 'Alice' });
    await updateProfile('u1', { display_name: 'Beatriz' }, 'teste');

    expect(h.forUpdate).toHaveBeenCalled();
    expect(h.audit).toHaveLength(1);
    // `to` e o que esta chamada gravou, nao o 'depois-relido' que outra requisicao deixou.
    expect(h.audit[0].input).toMatchObject({ field: 'display_name', from: 'Alice', to: 'Beatriz', door: 'teste' });
    expect(h.audit[0].trx).toBe(h.trx);
  });

  it('sem display_name no patch nao audita', async () => {
    h.setAnterior({ id: 'p1', display_name: 'Alice' });
    await updateProfile('u1', { bio: 'oi' }, 'teste');
    expect(h.audit).toHaveLength(0);
  });
});

describe('prepareNewGmProfileIdentity — executor', () => {
  it('consulta pelo executor recebido e nao pelo db global (pool de 10 conexoes)', async () => {
    const consultas: string[] = [];
    const q = (rows: unknown[]) => {
      const c: Record<string, unknown> = {};
      for (const m of ['select', 'where']) c[m] = () => c;
      c.executeTakeFirst = async () => rows[0];
      c.execute = async () => rows;
      return c;
    };
    const executor = {
      selectFrom: (t: string) => {
        consultas.push(t);
        return q(t === 'users' ? [{ username: 'void' }] : []);
      },
    };
    vi.mocked(db.selectFrom).mockClear();

    const r = await prepareNewGmProfileIdentity('u1', undefined, executor as never);

    expect(r).toEqual({ slug: 'void', nickname: 'void' });
    expect(consultas).toEqual(['users', 'profiles', 'gm_profiles', 'gm_slug_redirects']);
    expect(db.selectFrom).not.toHaveBeenCalled();
  });
});
