import { useCallback, useSyncExternalStore } from "react";

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
  applyHeaderVariant(theme, doc);
  return theme;
}

/** Aplica data-variant="dark" no header/footer (CSS .artificio-header[data-variant=dark]). */
export function applyHeaderVariant(theme: Theme, doc: Document = document): void {
  const v = theme === "dark" ? "dark" : "light";
  doc.querySelectorAll(".artificio-header, .artificio-footer").forEach((el) => {
    if (v === "dark") (el as HTMLElement).dataset.variant = "dark";
    else delete (el as HTMLElement).dataset.variant;
  });
}

/** Persiste o tema (dataset + cookie cross-subdomínio + localStorage + variant header/footer). */
export function setTheme(theme: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  applyHeaderVariant(theme, doc);
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

/** Botão de alternância de tema, autocontido (usa useTheme canônico). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={className ?? "artificio-theme-toggle"}
      aria-label="Alternar tema"
      title="Alternar tema"
      onClick={toggleTheme}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}

function subscribeToTheme(cb: () => void) {
  const observer = new MutationObserver(() => cb());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getThemeSnapshot(): Theme {
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;
  return resolveTheme();
}

/**
 * Tema do SSR: `dark`, o mesmo default do script inline que roda antes da
 * primeira pintura.
 *
 * Era `"light"` fixo, e sob SSR real isso divergia por construção. O script
 * inline do documento (`apps/mesas/frontend/src/root.tsx`) lê o cookie
 * `artificio_theme` e, sem cookie, escreve `data-theme="dark"` — então o
 * documento já está escuro quando o React hidrata, enquanto `Header` e `Footer`
 * chegavam do servidor com `data-variant="light"` e o logo navy. O primeiro
 * quadro misturava página escura com chrome claro, e só acertava depois da
 * hidratação: exatamente o flash que o script inline existe para evitar.
 *
 * `dark` porque é o default operacional dos módulos com SSR e o que o script
 * inline aplica na ausência de cookie — o caso da primeira visita, que é quando
 * o crawler e o visitante novo chegam. Para quem tem cookie `light`, o
 * `MutationObserver` de `subscribeToTheme` corrige no primeiro commit, sem
 * flash de conteúdo: o `data-theme` do `<html>` já está certo antes de qualquer
 * pintura, e o que se ajusta é só o `data-variant` do chrome.
 *
 * O caminho definitivo é o servidor ler o cookie da requisição e injetar o tema
 * no HTML, o que elimina a suposição. Isso exige passar o cookie até este hook
 * (contexto por requisição), mudança de contrato em 6 apps consumidores —
 * registrada como pendência, não feita aqui. Achado do Codex (P2) na PR #319.
 */
function getServerThemeSnapshot(): Theme {
  return "dark";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [theme]);
  return { theme, toggleTheme };
}
