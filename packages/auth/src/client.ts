import { useEffect, useState } from "react";
import type { User } from "./types.js";

const DEFAULT_ACCOUNTS_ORIGIN = "https://accounts.artificiorpg.com";

function readConfiguredAccountsOrigin(): string | null {
  const meta = import.meta as unknown as {
    env?: { VITE_ACCOUNTS_URL?: string };
  };
  const value = meta.env?.VITE_ACCOUNTS_URL;

  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAccountsOrigin(): string {
  return readConfiguredAccountsOrigin() ?? DEFAULT_ACCOUNTS_ORIGIN;
}

// Refresh de sessão single-flight: troca o cookie de refresh (7d) por um novo access (15m)
// no `accounts`. Várias requests que tomam 401 ao mesmo tempo compartilham UMA chamada.
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${getAccountsOrigin()}/api/auth/refresh`, { credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false);
  }
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/**
 * fetch com sessão SSO: sempre envia o cookie e, ao tomar 401, tenta UM refresh
 * (refresh cookie 7d → novo access) e repete a request uma vez. Sessão persiste
 * a janela do refresh, mesmo após fechar a aba/navegador. Use em toda chamada
 * autenticada para que o login dure de verdade.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const opts: RequestInit = { credentials: "include", ...init };
  const res = await fetch(input, opts);
  if (res.status !== 401) return res;
  const refreshed = await refreshSession();
  if (!refreshed) return res;
  return fetch(input, opts);
}

export interface UseSessionResult {
  user: User | null;
  loading: boolean;
}

function normalizeUser(value: unknown): User | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<User>;

  if (
    typeof record.id !== "string" ||
    typeof record.email !== "string" ||
    typeof record.name !== "string" ||
    (record.role !== "user" && record.role !== "admin")
  ) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    avatar: typeof record.avatar === "string" ? record.avatar : null,
  };
}

export function useSession(): UseSessionResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const meUrl = `${getAccountsOrigin()}/api/auth/me`;
        let response = await fetch(meUrl, { credentials: "include", signal: controller.signal });

        // Access expirado? Tenta refresh (cookie 7d) e repete o /me — mantém o login persistente.
        if (response.status === 401 && (await refreshSession())) {
          response = await fetch(meUrl, { credentials: "include", signal: controller.signal });
        }

        if (!response.ok) {
          setUser(null);
          return;
        }

        const body: unknown = await response.json();
        const userValue =
          body && typeof body === "object" && "user" in body
            ? (body as { user: unknown }).user
            : body;
        setUser(normalizeUser(userValue));
      } catch (error) {
        if (!controller.signal.aborted) {
          setUser(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      controller.abort();
    };
  }, []);

  return { user, loading };
}

export function redirectToLogin(returnUrl = window.location.href): void {
  const loginUrl = new URL("/login", getAccountsOrigin());
  loginUrl.searchParams.set("return", returnUrl);
  window.location.assign(loginUrl.toString());
}

/**
 * Encerra a sessão SSO no `accounts` (limpa o cookie `Domain=.artificiorpg.com`)
 * e redireciona. `redirectTo` default = origin atual = home do módulo.
 */
export function logout(redirectTo = window.location.origin): void {
  void fetch(`${getAccountsOrigin()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  })
    .catch(() => undefined)
    .finally(() => {
      window.location.assign(redirectTo);
    });
}
