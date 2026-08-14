import { describe, expect, it } from 'vitest';

import { mergeProfileIntoSession, normalizeMembers, normalizeSessionUser } from './session';
import type { User } from '../context/auth-context';

/**
 * A sessão é o dado mais sensível do app: `role` e `is_global_moderator`
 * decidem acesso à área administrativa (`App.tsx`) e a exclusão de comentário
 * alheio (`ResultCard.tsx`). Antes destes normalizadores o payload de
 * `GET /auth/me` ia direto para o estado (achado de review, PR #260).
 *
 * O que se testa aqui é a DIREÇÃO do fallback em cada campo de permissão —
 * payload corrompido tem que fechar portas, nunca abrir.
 */

const admin: User = {
  id: 'u1',
  full_name: 'Ana',
  username: 'ana',
  email: 'ana@example.com',
  role: 'admin',
  is_global_moderator: true,
};

describe('normalizeSessionUser', () => {
  it('recusa payload sem id: sem ele a comparação de autoria não funciona', () => {
    expect(normalizeSessionUser({ full_name: 'Sem id', role: 'admin' })).toBeNull();
    expect(normalizeSessionUser({ id: '', role: 'admin' })).toBeNull();
    for (const hostil of [null, undefined, 'texto', 42, [], true]) {
      expect(normalizeSessionUser(hostil)).toBeNull();
    }
  });

  it('rebaixa para member qualquer papel que não seja exatamente "admin"', () => {
    // A direção do fallback é a decisão de segurança: papel malformado não pode
    // virar acesso administrativo.
    for (const suspeito of [undefined, null, '', 'Admin', 'ADMIN', 'superadmin', 'member', 1, true, {}]) {
      expect(normalizeSessionUser({ id: 'u1', role: suspeito })?.role).toBe('member');
    }
    expect(normalizeSessionUser({ id: 'u1', role: 'admin' })?.role).toBe('admin');
  });

  it('só concede moderação global com true literal', () => {
    for (const suspeito of [undefined, null, 'true', 1, 'sim', {}]) {
      expect(normalizeSessionUser({ id: 'u1', is_global_moderator: suspeito })?.is_global_moderator)
        .toBe(false);
    }
    expect(normalizeSessionUser({ id: 'u1', is_global_moderator: true })?.is_global_moderator).toBe(true);
  });

  it('deixa username indefinido quando vazio, para o fallback de exibição valer', () => {
    expect(normalizeSessionUser({ id: 'u1', username: '' })?.username).toBeUndefined();
    expect(normalizeSessionUser({ id: 'u1' })?.username).toBeUndefined();
    expect(normalizeSessionUser({ id: 'u1', username: 'ana' })?.username).toBe('ana');
  });

  it('aceita id numérico e completa texto ausente sem descartar a sessão', () => {
    expect(normalizeSessionUser({ id: 7 })).toEqual({
      id: '7',
      full_name: '',
      username: undefined,
      email: '',
      role: 'member',
      is_global_moderator: false,
    });
  });
});

describe('mergeProfileIntoSession', () => {
  it('preserva permissão quando a resposta do perfil não a traz', () => {
    // Este era o bug: `setUser(res.data)` de `PATCH /users/profile` rebaixava um
    // admin a member no instante em que ele salvasse o próprio nome.
    const depois = mergeProfileIntoSession(admin, { full_name: 'Ana Maria' });
    expect(depois).toEqual({ ...admin, full_name: 'Ana Maria' });
    expect(depois?.role).toBe('admin');
    expect(depois?.is_global_moderator).toBe(true);
  });

  it('ignora tentativa de elevar privilégio vinda da rota de perfil', () => {
    const alvo: User = { ...admin, role: 'member', is_global_moderator: false };
    const depois = mergeProfileIntoSession(alvo, { role: 'admin', is_global_moderator: true });
    expect(depois?.role).toBe('member');
    expect(depois?.is_global_moderator).toBe(false);
  });

  it('mantém a sessão intacta quando a resposta é inutilizável', () => {
    for (const hostil of [null, undefined, 'erro', 42, []]) {
      expect(mergeProfileIntoSession(admin, hostil)).toEqual(admin);
    }
  });

  it('não inventa sessão a partir de usuário deslogado', () => {
    expect(mergeProfileIntoSession(null, { full_name: 'Ana' })).toBeNull();
  });
});

describe('normalizeMembers', () => {
  it('devolve lista vazia para payload que não é array', () => {
    for (const hostil of [null, undefined, 'erro', { items: [] }]) {
      expect(normalizeMembers(hostil)).toEqual([]);
    }
  });

  it('só marca banido com true literal, sem acusar por campo malformado', () => {
    const lista = normalizeMembers([
      { id: 'm1', banned: true },
      { id: 'm2', banned: 'true' },
      { id: 'm3' },
    ]);
    expect(lista.map((m) => m.banned)).toEqual([true, false, false]);
  });

  it('descarta registro sem id e mantém o resto', () => {
    expect(normalizeMembers([{ id: 'm1' }, { full_name: 'sem id' }, null, { id: 'm2' }])
      .map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  // Achado de review da PR #261: a listagem administrativa imprimia
  // "Invalid Date" na coluna de cadastro quando o timestamp não vinha.
  it('deixa created_at ausente em vez de data inválida', () => {
    for (const ruim of [undefined, null, '', 'ontem', 42]) {
      expect(normalizeMembers([{ id: 'm1', created_at: ruim }])[0].created_at).toBeUndefined();
    }
    expect(normalizeMembers([{ id: 'm1', created_at: '2026-08-13T10:00:00.000Z' }])[0].created_at)
      .toBe('2026-08-13T10:00:00.000Z');
  });
});
