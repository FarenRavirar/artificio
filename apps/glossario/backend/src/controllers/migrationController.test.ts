import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcrypt';

// migrationController importa ../config/database (exige POSTGRES_PASSWORD) e
// migrationToken (exige JWT_SECRET). Setamos antes do import dinâmico; os testes
// injetam exec/client/issue, sem tocar o Pool.
let ctrl: typeof import('./migrationController.js');
let issueMigrationToken: typeof import('../auth/migrationToken.js').issueMigrationToken;
let SSO_NO_PASSWORD: string;

beforeAll(async () => {
  process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'test-only';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-please';
  ctrl = await import('./migrationController.js');
  issueMigrationToken = (await import('../auth/migrationToken.js')).issueMigrationToken;
  SSO_NO_PASSWORD = (await import('../auth/resolveLocalUser.js')).SSO_NO_PASSWORD;
});

function execReturning(rows: Array<Record<string, unknown>>) {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  return {
    calls,
    query: async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      return { rows };
    },
  };
}

describe('runVerify', () => {
  it('ok: email + senha legada corretos → token', async () => {
    const exec = execReturning([{ id: 'leg-1', password_hash: '$2b$10$hashlegado' }]);
    const result = await ctrl.runVerify(
      { email: 'Velho@Provedor.com', password: 'senha123' },
      { exec, compare: async () => true, issue: (id) => `tok:${id}` }
    );
    expect(result.ok).toBe(true);
    expect(result.token).toBe('tok:leg-1');
    // email normalizado lower-case na query
    expect(exec.calls[0].params[0]).toBe('velho@provedor.com');
  });

  it('falha: senha incorreta → ok:false sem token', async () => {
    const exec = execReturning([{ id: 'leg-1', password_hash: '$2b$10$hashlegado' }]);
    const result = await ctrl.runVerify(
      { email: 'velho@provedor.com', password: 'errada' },
      { exec, compare: async () => false }
    );
    expect(result.ok).toBe(false);
    expect(result.token).toBeUndefined();
  });

  it('falha: email inexistente → ok:false (sem enumeração)', async () => {
    const exec = execReturning([]);
    let comparedHash = '';
    const result = await ctrl.runVerify(
      { email: 'naoexiste@x.com', password: 'qualquer' },
      { exec, compare: async (_plain, hash) => { comparedHash = hash; return false; } }
    );
    expect(result.ok).toBe(false);
    expect(comparedHash).toBeTruthy(); // compare dummy roda mesmo sem usuário (timing)
    expect(bcrypt.getRounds(comparedHash)).toBe(10); // mesmo cost do cadastro legado
  });

  it('falha: usuário SSO-provisionado (senha sentinela) nunca migra', async () => {
    const exec = execReturning([{ id: 'leg-1', password_hash: SSO_NO_PASSWORD }]);
    const result = await ctrl.runVerify(
      { email: 'sso@gmail.com', password: 'qualquer' },
      { exec, compare: async () => true }
    );
    expect(result.ok).toBe(false);
  });
});

// Fake client que devolve respostas por ordem de chamada e grava o SQL.
type FakeQueryResult = { rows: Array<Record<string, unknown>> };

function fakeClient(script: Array<(text: string) => FakeQueryResult | undefined>) {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  let released = false;
  return {
    calls,
    released: () => released,
    release: () => { released = true; },
    query: async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      for (const fn of script) {
        const r = fn(text);
        if (r !== undefined) return r;
      }
      return { rows: [] };
    },
  };
}

describe('runClaim', () => {
  it('token inválido → 400, sem transação', async () => {
    const out = await ctrl.runClaim(
      { sub: 'sub-1', googleEmail: 'g@gmail.com', migrationToken: 'lixo' },
      { getClient: async () => { throw new Error('não deveria abrir client'); } }
    );
    expect(out.status).toBe(400);
  });

  it('vincula: sem auto-provisionado, grava sso_user_id + email Google', async () => {
    const token = issueMigrationToken('leg-9');
    const client = fakeClient([
      (t) => (/WHERE id = \$1 FOR UPDATE/.test(t) ? { rows: [{ id: 'leg-9', sso_user_id: null, email: 'velho@x.com' }] } : undefined),
      (t) => (/sso_user_id = \$1 AND id <> \$2/.test(t) ? { rows: [] } : undefined),
    ]);
    const out = await ctrl.runClaim(
      { sub: 'sub-9', googleEmail: 'novo@gmail.com', migrationToken: token },
      { getClient: async () => client }
    );
    expect(out.status).toBe(200);
    expect(out.body.merged).toBe(false);
    const update = client.calls.find((c) => /UPDATE public\.users SET sso_user_id = \$1, email = \$2/.test(c.text));
    expect(update?.params).toEqual(['sub-9', 'novo@gmail.com', 'leg-9']);
    expect(client.calls.some((c) => c.text === 'COMMIT')).toBe(true);
    expect(client.released()).toBe(true);
  });

  it('merge: auto-provisionado sentinel existe → repoint FKs + dedup voto + delete auto', async () => {
    const token = issueMigrationToken('leg-7');
    const client = fakeClient([
      (t) => (/WHERE id = \$1 FOR UPDATE/.test(t) ? { rows: [{ id: 'leg-7', sso_user_id: null, email: 'velho@x.com' }] } : undefined),
      (t) => (/sso_user_id = \$1 AND id <> \$2/.test(t) ? { rows: [{ id: 'auto-7', password_hash: SSO_NO_PASSWORD }] } : undefined),
    ]);
    const out = await ctrl.runClaim(
      { sub: 'sub-7', googleEmail: 'novo@gmail.com', migrationToken: token },
      { getClient: async () => client }
    );
    expect(out.status).toBe(200);
    expect(out.body.merged).toBe(true);
    // dedup de voto (dois DELETEs em term_votes) com (from=auto, to=legacy)
    const voteDeletes = client.calls.filter((c) => /DELETE FROM public\.term_votes/.test(c.text));
    expect(voteDeletes.length).toBe(2);
    expect(voteDeletes[0].params).toEqual(['auto-7', 'leg-7']);
    // repoint do added_by e delete do auto
    expect(client.calls.some((c) => /UPDATE public\.terms SET added_by = \$2/.test(c.text) && c.params[0] === 'auto-7' && c.params[1] === 'leg-7')).toBe(true);
    expect(client.calls.some((c) => /DELETE FROM public\.users WHERE id = \$1/.test(c.text) && c.params[0] === 'auto-7')).toBe(true);
  });

  it('conflito: Google já vinculado a outra conta legada real → 409, sem merge', async () => {
    const token = issueMigrationToken('leg-8');
    const client = fakeClient([
      (t) => (/WHERE id = \$1 FOR UPDATE/.test(t) ? { rows: [{ id: 'leg-8', sso_user_id: null, email: 'velho@x.com' }] } : undefined),
      (t) => (/sso_user_id = \$1 AND id <> \$2/.test(t) ? { rows: [{ id: 'leg-real-2', password_hash: '$2b$10$hashlegado' }] } : undefined),
    ]);
    const out = await ctrl.runClaim(
      { sub: 'sub-8', googleEmail: 'novo@gmail.com', migrationToken: token },
      { getClient: async () => client }
    );
    expect(out.status).toBe(409);
    expect(client.calls.some((c) => /DELETE FROM public\.users WHERE id = \$1/.test(c.text))).toBe(false);
    expect(client.calls.some((c) => c.text === 'ROLLBACK')).toBe(true);
  });

  it('idempotente: legado já vinculado ao mesmo sub → 200 already_linked', async () => {
    const token = issueMigrationToken('leg-5');
    const client = fakeClient([
      (t) => (/WHERE id = \$1 FOR UPDATE/.test(t) ? { rows: [{ id: 'leg-5', sso_user_id: 'sub-5', email: 'g@gmail.com' }] } : undefined),
    ]);
    const out = await ctrl.runClaim(
      { sub: 'sub-5', googleEmail: 'g@gmail.com', migrationToken: token },
      { getClient: async () => client }
    );
    expect(out.status).toBe(200);
    expect(out.body.already_linked).toBe(true);
  });

  it('conflito: legado vinculado a OUTRO sub → 409 + rollback', async () => {
    const token = issueMigrationToken('leg-3');
    const client = fakeClient([
      (t) => (/WHERE id = \$1 FOR UPDATE/.test(t) ? { rows: [{ id: 'leg-3', sso_user_id: 'sub-outro', email: 'x@x.com' }] } : undefined),
    ]);
    const out = await ctrl.runClaim(
      { sub: 'sub-3', googleEmail: 'g@gmail.com', migrationToken: token },
      { getClient: async () => client }
    );
    expect(out.status).toBe(409);
    expect(client.calls.some((c) => c.text === 'ROLLBACK')).toBe(true);
  });
});
