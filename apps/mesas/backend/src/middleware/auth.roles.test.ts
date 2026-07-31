import { describe, expect, it } from 'vitest';
import { resolveEffectiveMesasRole } from './auth.js';

describe('precedência de papel global no mesas', () => {
  it('admin central vence papel local', () => {
    expect(resolveEffectiveMesasRole('admin', 'player')).toBe('admin');
  });

  it('moderator central não ganha capacidade administrativa de domínio', () => {
    expect(resolveEffectiveMesasRole('moderator', 'player')).toBe('player');
    expect(resolveEffectiveMesasRole('moderator', 'gm')).toBe('gm');
  });

  it('user central preserva papel de domínio local', () => {
    expect(resolveEffectiveMesasRole('user', 'gm')).toBe('gm');
  });

  // O furo que este bloco fecha: `mesas.users.role` pode valer 'admin' de antes
  // do SSO, e o fallback devolvia esse resíduo — rebaixar a conta no `accounts.`
  // não tirava o acesso, e todo `requireRole('admin')` seguia liberando
  // (achado de review, PR #233).
  it('admin local não sobrevive a rebaixamento global', () => {
    expect(resolveEffectiveMesasRole('user', 'admin')).toBe('player');
    expect(resolveEffectiveMesasRole('moderator', 'admin')).toBe('player');
  });

  it('admin local segue irrelevante quando o central também é admin', () => {
    expect(resolveEffectiveMesasRole('admin', 'admin')).toBe('admin');
  });
});
