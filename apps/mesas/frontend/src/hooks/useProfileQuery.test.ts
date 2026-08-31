import { describe, expect, it } from 'vitest';
import { deriveGmSlug } from './useProfileQuery';

/**
 * O POST /api/v1/gm/profile rejeita slug fora de `/^[a-z0-9-]+$/` com 400
 * (gmPanel.ts). Este teste fixa o contrato do cliente: a derivação nunca
 * entrega slug que o backend recusaria.
 *
 * `deriveGmSlug` vive neste módulo desde a consolidação do editor (spec 099,
 * pós-B5): o único consumidor é o `useUpdateGm` daqui — antes vivia em
 * `utils/gmSlug.ts`.
 */

const SLUG_REGEX = /^[a-z0-9-]+$/;

describe('deriveGmSlug', () => {
  it('usa username como base e sanitiza underscore', () => {
    expect(deriveGmSlug({ id: 'u1', username: 'mestre_lobo' })).toBe('mestre-lobo');
  });

  it('sanitiza email com ponto e + quando não há username', () => {
    expect(
      deriveGmSlug({ id: 'u1', username: null, email: 'joao.silva+mesas@gmail.com' }),
    ).toBe('joao-silva-mesas');
  });

  it('resultado sempre casa com o regex do POST', () => {
    const casos = [
      { id: 'u1', username: 'MESTRE_Caçador!' },
      { id: 'u1', username: null, email: 'A.B+C@x.com' },
      { id: 'u1' },
      { id: 'u1', username: '___' },
      { id: 'u1', username: ' João ' },
    ];
    for (const user of casos) {
      expect(deriveGmSlug(user)).toMatch(SLUG_REGEX);
    }
  });

  it('fallback user-<id 8> quando username e email ausentes', () => {
    expect(deriveGmSlug({ id: 'abcdefgh1234' })).toBe('user-abcdefgh');
  });

  it('fallback quando email não tem parte local', () => {
    expect(deriveGmSlug({ id: 'abcdefgh', username: null, email: '@x.com' })).toBe(
      'user-abcdefgh',
    );
  });

  it('nunca devolve slug vazio', () => {
    expect(deriveGmSlug({ id: '', username: null, email: undefined })).toBe('user-');
  });
});
