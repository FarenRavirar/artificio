import { describe, it, expect, beforeAll } from 'vitest';
import type { Session } from '@artificio/auth';
import type { QueryExecutor, QueryResult } from './resolveLocalUser';

// resolveLocalUser importa ../config/database (que exige POSTGRES_PASSWORD ou
// process.exit). Os testes injetam executor e nunca tocam o Pool; basta setar a
// env antes do import dinâmico.
let resolveLocalUser: typeof import('./resolveLocalUser').resolveLocalUser;
let SSO_NO_PASSWORD: string;

beforeAll(async () => {
  process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'test-only';
  const mod = await import('./resolveLocalUser');
  resolveLocalUser = mod.resolveLocalUser;
  SSO_NO_PASSWORD = mod.SSO_NO_PASSWORD;
});

function makeSession(over: Partial<Session['user']> = {}): Session {
  return {
    exp: 9999999999,
    user: {
      id: 'sub-123',
      email: 'User@Example.com',
      name: 'Fulano',
      role: 'user',
      avatar: null,
      ...over,
    },
  } as Session;
}

type Handler = {
  match: (text: string) => boolean;
  result: (text: string, params: any[]) => QueryResult;
};

function makeExecutor(handlers: Handler[]): QueryExecutor & { calls: Array<{ text: string; params: any[] }> } {
  const calls: Array<{ text: string; params: any[] }> = [];
  const query = async (text: string, params: any[] = []): Promise<QueryResult> => {
    calls.push({ text, params });
    for (const h of handlers) {
      if (h.match(text)) return h.result(text, params);
    }
    return { rows: [], rowCount: 0 };
  };
  return { query, calls } as any;
}

const isSelectBySso = (t: string) => /^\s*SELECT/i.test(t) && /WHERE sso_user_id = \$1/.test(t);
const isSelectByEmail = (t: string) => /lower\(email\) = \$1/.test(t);
const isUpdateLink = (t: string) => /^\s*UPDATE/i.test(t);
const isInsert = (t: string) => /^\s*INSERT/i.test(t);

describe('resolveLocalUser', () => {
  it('(a) já vinculado por sso_user_id → usa, sem insert/update', async () => {
    const exec = makeExecutor([
      {
        match: isSelectBySso,
        result: () => ({
          rows: [{ id: 'u-1', email: 'user@example.com', username: 'u', full_name: 'F', role: 'admin', sso_user_id: 'sub-123' }],
        }),
      },
    ]);
    const local = await resolveLocalUser(makeSession(), exec);
    expect(local.id).toBe('u-1');
    expect(local.role).toBe('admin');
    expect(exec.calls.some((c) => isUpdateLink(c.text))).toBe(false);
    expect(exec.calls.some((c) => isInsert(c.text))).toBe(false);
  });

  it('(b) email bate → vincula sso_user_id e preserva id/role legados', async () => {
    const legacy = { id: 'u-legacy', email: 'User@Example.com', username: 'leg', full_name: 'Legado', role: 'member', sso_user_id: null };
    const exec = makeExecutor([
      { match: isSelectBySso, result: () => ({ rows: [] }) },
      { match: isSelectByEmail, result: () => ({ rows: [legacy] }) },
      { match: isUpdateLink, result: () => ({ rows: [{ ...legacy, sso_user_id: 'sub-123' }] }) },
    ]);
    const local = await resolveLocalUser(makeSession(), exec);
    expect(local.id).toBe('u-legacy');
    expect(local.role).toBe('member');
    expect(local.sso_user_id).toBe('sub-123');
    const update = exec.calls.find((c) => isUpdateLink(c.text));
    expect(update?.params).toEqual(['sub-123', 'u-legacy']);
  });

  it('(c) sem match → provisiona usuário novo (member, senha sentinela)', async () => {
    const exec = makeExecutor([
      { match: isSelectBySso, result: () => ({ rows: [] }) },
      { match: isSelectByEmail, result: () => ({ rows: [] }) },
      {
        match: isInsert,
        result: (_t, p) => ({ rows: [{ id: 'u-new', email: p[2], username: p[1], full_name: p[0], role: 'member', sso_user_id: p[4] }] }),
      },
    ]);
    const local = await resolveLocalUser(makeSession(), exec);
    expect(local.id).toBe('u-new');
    expect(local.role).toBe('member');
    const insert = exec.calls.find((c) => isInsert(c.text));
    expect(insert?.params?.[3]).toBe(SSO_NO_PASSWORD);
    expect(insert?.params?.[4]).toBe('sub-123');
  });

  it('(d) match por email é case-insensitive (lower-case do token)', async () => {
    let seenEmailParam: string | undefined;
    const exec = makeExecutor([
      { match: isSelectBySso, result: () => ({ rows: [] }) },
      {
        match: isSelectByEmail,
        result: (_t, p) => {
          seenEmailParam = p[0];
          return { rows: [{ id: 'u-ci', email: 'USER@example.com', username: 'ci', full_name: 'CI', role: 'member', sso_user_id: null }] };
        },
      },
      { match: isUpdateLink, result: () => ({ rows: [{ id: 'u-ci', email: 'USER@example.com', username: 'ci', full_name: 'CI', role: 'member', sso_user_id: 'sub-123' }] }) },
    ]);
    const local = await resolveLocalUser(makeSession({ email: 'MiXeD@Example.COM' }), exec);
    expect(seenEmailParam).toBe('mixed@example.com');
    expect(local.id).toBe('u-ci');
  });
});
