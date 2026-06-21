import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { brandLogoNavy, brandLogoNeg, applyFavicon, ThemeIcon, useTheme } from "@artificio/ui";
import { useSession, getAccountsOrigin, logout } from "@artificio/auth/client";
import { BRAND_TAGLINE_FREE, BRAND_ORIGIN, BRAND_DOMAIN } from "@artificio/config";
import "./styles.css";

applyFavicon();

const PORTAL_URL = BRAND_ORIGIN;

// getSafeReturnUrl: valida e canonicaliza a URL de retorno.
// CodeQL (github-advanced-security) sinaliza location.replace() com valor de query param
// como XSS (High) e URL redirect (Medium). Falso positivo: isAllowedReturnUrl (protocolo
// https + hostname *.artificiorpg.com) já bloqueia javascript:/data: e domínios externos.
// A canonicalizacao via url.toString() e defesa-em-profundidade: normaliza a URL (remove
// porta default, ordena querystring etc.) antes de entrar em location.replace().
function getSafeReturnUrl(): string {
  const params = new URLSearchParams(globalThis.location.search);
  const value = params.get("return");
  if (!value) return PORTAL_URL;

  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      (url.hostname === BRAND_DOMAIN || url.hostname.endsWith(`.${BRAND_DOMAIN}`))
    ) {
      return url.toString();
    }
  } catch {
    // URL invalida ou protocolo nao-https → fallback seguro
  }

  return PORTAL_URL;
}

function LoginView() {
  const [checkingSession, setCheckingSession] = useState(true);
  const returnUrl = getSafeReturnUrl();
  const { theme } = useTheme();
  const logo = theme === "dark" ? brandLogoNeg : brandLogoNavy;
  const googleUrl = new URL("/api/auth/google", globalThis.location.origin);
  googleUrl.searchParams.set("return", returnUrl);

  useEffect(() => {
    const controller = new AbortController();

    async function redirectIfAlreadySignedIn() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.ok) {
          globalThis.location.replace(returnUrl);
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Falha ao verificar sessao:", error);
      }

      if (!controller.signal.aborted) {
        setCheckingSession(false);
      }
    }

    void redirectIfAlreadySignedIn();

    return () => {
      controller.abort();
    };
  }, [returnUrl]);

  return (
    <section className="accounts-panel" aria-labelledby="login-title">
      <a className="accounts-brand" href={PORTAL_URL}>
        <img
          alt={logo.alt}
          className="accounts-brand-logo"
          height={logo.height}
          src={logo.src}
          width={logo.width}
        />
      </a>
      <p className="accounts-kicker">Login único Artifício RPG</p>
      <h1 id="login-title">Entrar</h1>
      <p className="accounts-subtitle">Use sua conta Google para acessar os projetos do Artifício.</p>
      {checkingSession ? (
        <div className="accounts-checking" role="status">
          <span className="accounts-spinner" aria-hidden="true" />
          Validando sessão...
        </div>
      ) : (
        <a className="accounts-login" href={googleUrl.toString()}>
          <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18">
            <path
              fill="#FFC107"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#FF3D00"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#4CAF50"
              d="M3.97 10.72A5.4 5.4 0 0 1 3.97 7.3V4.96H.96a9 9 0 0 0 0 8.09l3.01-2.33Z"
            />
            <path
              fill="#1976D2"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
          Entrar com Google
        </a>
      )}
      <div className="accounts-divider" aria-hidden="true" />
      <p className="accounts-note">
        {BRAND_TAGLINE_FREE}
      </p>
    </section>
  );
}

function ContaView() {
  const { user, loading } = useSession();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!loading && !user) {
      const loginUrl = new URL("/login", getAccountsOrigin());
      loginUrl.searchParams.set("return", globalThis.location.href);
      globalThis.location.replace(loginUrl.toString());
    }
  }, [loading, user]);

  const handleLogout = useCallback(() => {
    logout(PORTAL_URL);
  }, []);

  if (loading || !user) {
    return (
      <section className="accounts-panel">
        <p className="accounts-subtitle">Carregando...</p>
      </section>
    );
  }

  return (
    <section className="accounts-panel" aria-labelledby="conta-title">
      <h1 id="conta-title">Conta Artifício</h1>
      {user.avatar ? (
        <img src={user.avatar} alt="" className="accounts-avatar" width="64" height="64" />
      ) : (
        <div className="accounts-avatar accounts-avatar-fallback">
          {user.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
        </div>
      )}
      <p className="accounts-user-name">{user.name}</p>
      {user.email ? <p className="accounts-user-email">{user.email}</p> : null}
      <div className="accounts-actions">
        <button className="accounts-login accounts-login-secondary" type="button" onClick={handleLogout}>
          Sair
        </button>
        <a className="accounts-login" href={PORTAL_URL}>
          Voltar ao Portal
        </a>
      </div>
    </section>
  );
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const path = globalThis.location.pathname;

  return (
    <main className="accounts-page">
      <button
        className="accounts-theme-toggle"
        type="button"
        aria-label="Alternar tema"
        title="Alternar tema"
        onClick={toggleTheme}
      >
        <ThemeIcon theme={theme} />
      </button>
      {path === "/conta" ? <ContaView /> : <LoginView />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
