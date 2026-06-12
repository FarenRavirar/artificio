import { useEffect, useState } from "react";

// Tema cross-subdomínio do Artifício: cookie ÚNICO `artificio_theme`
// (Domain=.artificiorpg.com) compartilhado por todos os módulos. Este é o
// mecanismo canônico — módulos NÃO inventam outro. Espelha apps/site
// (SiteHeader.astro #theme-toggle + Base.astro).

export type Theme = "light" | "dark";
const THEME_COOKIE = "artificio_theme";

export function readThemeCookie(doc: Document = document): Theme | null {
  const prefix = `${THEME_COOKIE}=`;
  for (const part of doc.cookie.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      const raw = decodeURIComponent(value.slice(prefix.length));
      return raw === "dark" ? "dark" : raw === "light" ? "light" : null;
    }
  }
  return null;
}

export function writeThemeCookie(theme: Theme, doc: Document = document): void {
  doc.cookie = `${THEME_COOKIE}=${theme}; Path=/; Domain=.artificiorpg.com; Max-Age=31536000; SameSite=Lax; Secure`;
}

/** Resolve o tema: cookie cross-subdomínio → localStorage → preferência do SO. */
export function resolveTheme(doc: Document = document): Theme {
  const cookie = readThemeCookie(doc);
  if (cookie) return cookie;
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage indisponível: cai na preferência do SO.
  }
  try {
    if (matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    // matchMedia indisponível.
  }
  return "light";
}

/** Aplica o tema resolvido ao documento (chamar no boot dos SPAs). */
export function applyTheme(doc: Document = document): Theme {
  const theme = resolveTheme(doc);
  doc.documentElement.dataset.theme = theme;
  return theme;
}

/** Persiste o tema (dataset + cookie cross-subdomínio + localStorage). */
export function setTheme(theme: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  writeThemeCookie(theme, doc);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Persistência é conveniência, não requisito.
  }
}

/** Ícone do tema: lua no modo claro (clique→escuro), sol no modo escuro. */
export function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

/** Botão de alternância de tema, autocontido (estado próprio via cookie). */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(resolveTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      className={className ?? "artificio-theme-toggle"}
      aria-label="Alternar tema"
      title="Alternar tema"
      onClick={toggle}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
