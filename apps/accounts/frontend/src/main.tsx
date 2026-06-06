import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { brandLogoNavy, brandLogoNeg } from "@artificio/ui";
import "./styles.css";

const PORTAL_URL = "https://beta.artificiorpg.com";
const THEME_COOKIE = "artificio_theme";

function isAllowedReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isArtificioHost =
      url.hostname === "artificiorpg.com" || url.hostname.endsWith(".artificiorpg.com");

    return (
      url.protocol === "https:" &&
      isArtificioHost &&
      url.origin !== window.location.origin
    );
  } catch {
    return false;
  }
}

function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("return");
  return value && isAllowedReturnUrl(value) ? value : PORTAL_URL;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function writeThemeCookie(theme: "light" | "dark"): void {
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Domain=.artificiorpg.com; Max-Age=31536000; SameSite=Lax; Secure`;
}

function getInitialTheme(): "light" | "dark" {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("theme");
  if (fromQuery === "dark" || fromQuery === "light") return fromQuery;

  const fromCookie = readCookie(THEME_COOKIE);
  if (fromCookie === "dark" || fromCookie === "light") return fromCookie;

  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage pode estar indisponível; cai no sistema.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [checkingSession, setCheckingSession] = useState(true);
  const returnUrl = getReturnUrl();
  const logo = theme === "dark" ? brandLogoNeg : brandLogoNavy;
  const googleUrl = new URL("/api/auth/google", window.location.origin);
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
          window.location.replace(returnUrl);
          return;
        }
      } catch {
        // Sem sessão válida ou rede indisponível: exibe o login Google.
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeThemeCookie(theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Persistência de tema é conveniência, não requisito para logar.
    }
  }, [theme]);

  return (
    <main className="accounts-page">
      <button
        className="accounts-theme-toggle"
        type="button"
        onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
      >
        {theme === "dark" ? "Tema claro" : "Tema escuro"}
      </button>
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
        <h1 id="login-title">Entrar</h1>
        <p>Use sua conta Google para acessar os módulos do Artifício.</p>
        {checkingSession ? (
          <p className="accounts-note">Validando sessão...</p>
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
        <p className="accounts-note">
          Gratuito, sem anúncios, sem coleta desnecessária.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
