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
});
