import type { NavItem } from "./modules.js";

export interface NavProps {
  items: NavItem[];
  currentHref?: string;
  /**
   * Chamado ao ativar um link. Existe para o painel mobile se fechar na navegação:
   * o handler fica no `<a>`, que é interativo de nascença (teclado, toque e mouse de
   * graça), em vez de num `<div>` com `onClick` — elemento não-interativo com handler
   * não tem equivalente por teclado (Sonar S6847/S1082).
   */
  onNavigate?: () => void;
}

function normalizeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.hostname.toLowerCase();
  } catch {
    // Fallback sem regex de repeticao ancorada (evita ReDoS polinomial — CodeQL/Sonar):
    // remove barras finais por slice em vez de /\/+$/.
    let end = href.length;
    while (end > 0 && href.codePointAt(end - 1) === 47 /* "/" */) end--;
    return href.slice(0, end).toLowerCase();
  }
}

export function Nav({ items, currentHref, onNavigate }: Readonly<NavProps>) {
  const normalizedCurrent = normalizeHref(currentHref);

  return (
    <nav aria-label="Modulos do Artificio">
      <ul className="artificio-nav-list">
        {items.map((item) => {
          const isCurrent = normalizedCurrent !== null && normalizeHref(item.href) === normalizedCurrent;

          return (
            <li key={item.href}>
              <a
                aria-current={isCurrent ? "page" : undefined}
                className="artificio-nav-link"
                href={item.href}
                onClick={onNavigate}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
