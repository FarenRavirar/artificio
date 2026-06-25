import { redirectToLogin } from '@artificio/auth/client';
import { MODULE_ORIGINS } from '@artificio/config';

const DEFAULT_MESAS_PUBLIC_ORIGIN = MODULE_ORIGINS.mesas;

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

export function getMesasReturnUrl(path?: string): string {
  const defaultPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : '/';
  const resolvedPath = path ?? defaultPath;
  const origin = getMesasPublicOrigin();
  const url = new URL(resolvedPath || '/', origin);
  return new URL(`${url.pathname}${url.search}${url.hash}`, origin).toString();
}

export function startSsoLogin(path?: string): void {
  redirectToLogin(getMesasReturnUrl(path));
}
