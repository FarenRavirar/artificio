import { describe, expect, it, vi } from 'vitest';

const redirectToLogin = vi.fn();

vi.mock('@artificio/auth/client', () => ({
  redirectToLogin,
}));

describe('SSO redirect', () => {
  it('builds mesas return URL on production subdomain', async () => {
    const { getMesasReturnUrl } = await import('../utils/auth');

    expect(getMesasReturnUrl('/painel?tab=mesas')).toBe('https://mesas.artificiorpg.com/painel?tab=mesas');
  });

  it('redirects to accounts with mesas return URL', async () => {
    const { startSsoLogin } = await import('../utils/auth');

    startSsoLogin('/gestao');

    expect(redirectToLogin).toHaveBeenCalledWith('https://mesas.artificiorpg.com/gestao');
  });
});
