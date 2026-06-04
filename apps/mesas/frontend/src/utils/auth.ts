import { redirectToLogin } from '@artificio/auth/client';

const MESAS_PUBLIC_ORIGIN = 'https://mesas.artificiorpg.com';

export function getMesasReturnUrl(path = `${window.location.pathname}${window.location.search}${window.location.hash}`): string {
  return new URL(path || '/', MESAS_PUBLIC_ORIGIN).toString();
}

export function startSsoLogin(path?: string): void {
  redirectToLogin(getMesasReturnUrl(path));
}
