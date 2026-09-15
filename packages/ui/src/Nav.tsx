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
  /**
   * Nome acessível do `<nav>` (T7.5, spec 102).
   *
   * O default descreve o nav de PROJETOS, que é o uso original. A `moduleNav` passa o
   * nome do módulo: até aqui ela herdava o mesmo rótulo, e o `mesas` anunciava
   * "Catálogo" sob o nome "Modulos do Artificio". Pior no painel mobile, onde os dois
   * navs renderizam juntos — duas regiões de navegação com nome acessível IDÊNTICO, que
   * o leitor de tela não tem como distinguir (WCAG 2.4.1 / técnica ARIA11).
   *
   * O default também corrige a grafia: era `"Modulos do Artificio"`, sem acento.
   */
  label?: string;
  /**
   * `id` de um elemento VISÍVEL que já nomeia este nav (T7.5, spec 102).
   *
   * Preferido ao `label` quando o rótulo está na tela — caso do bloco de módulo dentro
   * do painel público. Repetir o texto num `aria-label` criaria duas fontes para o mesmo
   * nome, que saem de sincronia na primeira edição; `aria-labelledby` aponta para a que
   * o usuário lê. Tem precedência sobre `aria-label` na própria especificação ARIA, e por
   * isso os dois nunca saem juntos aqui.
   */
  labelledBy?: string;
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

export function Nav({
  items,
  currentHref,
  onNavigate,
  label = "Módulos do Artifício",
  labelledBy,
}: Readonly<NavProps>) {
  const normalizedCurrent = normalizeHref(currentHref);

  return (
    /* Um nome, nunca dois: com `aria-labelledby` presente o `aria-label` é ignorado pelo
       navegador, e emitir os dois só deixaria texto morto no HTML para divergir depois. */
    <nav aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}>
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
