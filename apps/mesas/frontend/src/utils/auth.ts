import { redirectToLogin } from '@artificio/auth/client';

const DEFAULT_MESAS_PUBLIC_ORIGIN = 'https://mesas.artificiorpg.com';

const toOrigin = (value?: string): string | null => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export function getMesasPublicOrigin(): string {
  return toOrigin(import.meta.env.VITE_PUBLIC_SITE_URL)
    ?? toOrigin(import.meta.env.VITE_API_URL)
    ?? (typeof window !== 'undefined' && window.location.origin !== 'null' ? window.location.origin : null)
    ?? DEFAULT_MESAS_PUBLIC_ORIGIN;
}

export function getMesasReturnUrl(path = `${window.location.pathname}${window.location.search}${window.location.hash}`): string {
  const origin = getMesasPublicOrigin();
  const url = new URL(path || '/', origin);
  return new URL(`${url.pathname}${url.search}${url.hash}`, origin).toString();
}

export function startSsoLogin(path?: string): void {
  redirectToLogin(getMesasReturnUrl(path));
}
