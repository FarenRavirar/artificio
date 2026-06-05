import { afterEach, describe, expect, it, vi } from 'vitest';

const redirectToLogin = vi.fn();

vi.mock('@artificio/auth/client', () => ({
  redirectToLogin,
}));

describe('SSO redirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    redirectToLogin.mockReset();
  });

  it('builds mesas return URL on production subdomain', async () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://mesas.artificiorpg.com');

    const { getMesasReturnUrl } = await import('../utils/auth');

    expect(getMesasReturnUrl('/painel?tab=mesas')).toBe('https://mesas.artificiorpg.com/painel?tab=mesas');
  });

  it('falls back to the browser origin when no public URL is configured', async () => {
    const { getMesasReturnUrl } = await import('../utils/auth');

    expect(getMesasReturnUrl('/painel?tab=mesas')).toBe('http://localhost:3000/painel?tab=mesas');
  });

  it('builds beta return URL from VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://mesasbeta.artificiorpg.com');

    const { getMesasReturnUrl } = await import('../utils/auth');

    expect(getMesasReturnUrl('/painel?tab=mesas')).toBe('https://mesasbeta.artificiorpg.com/painel?tab=mesas');
  });

  it('keeps only the path when a full external URL is passed', async () => {
    vi.stubEnv('VITE_API_URL', 'https://mesasbeta.artificiorpg.com');

    const { getMesasReturnUrl } = await import('../utils/auth');

    expect(getMesasReturnUrl('https://evil.com/gestao?x=1#top')).toBe('https://mesasbeta.artificiorpg.com/gestao?x=1#top');
  });

  it('redirects to accounts with mesas return URL', async () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://mesas.artificiorpg.com');

    const { startSsoLogin } = await import('../utils/auth');

    startSsoLogin('/gestao');

    expect(redirectToLogin).toHaveBeenCalledWith('https://mesas.artificiorpg.com/gestao');
  });
});
