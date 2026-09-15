/**
 * Botão hambúrguer do header (T7.1, spec 102).
 *
 * Existe porque a mesma marcação estava em TRÊS lugares — o toggle público e o de
 * sessão em `Header.tsx`, mais o público em `apps/site/src/components/SiteHeaderIsland.tsx`,
 * que tem header próprio. Três cópias de um SVG idêntico é a "exceção por app" que o
 * `AGENTS.md` trata como dívida por definição: o dia em que o ícone mudar, duas delas
 * ficam para trás em silêncio. Achado de duplicação do Sonar na PR #323 (6,6% em código
 * novo, 44% no `Header.tsx` e 46% no island).
 *
 * O componente é de APRESENTAÇÃO: não conhece estado de painel nem exclusão mútua —
 * quem abre e fecha continua sendo o header que o usa, que é onde o estado vive.
 */
export interface NavToggleProps {
  /**
   * `artificio-nav-toggle` (público, 1º slot) ou `artificio-menu-toggle` (sessão, 4º).
   * É a classe que o CSS usa para mostrar ou esconder o botão em cada faixa de largura,
   * então ela é escolha de quem chama, não default daqui.
   */
  className: "artificio-nav-toggle" | "artificio-menu-toggle";
  /** Nome acessível. Os dois toggles convivem em ≤860px e precisam se distinguir. */
  label: string;
  /** Estado do painel que este botão controla, para o `aria-expanded`. */
  expanded: boolean;
  onClick: () => void;
}

export function NavToggle({ className, label, expanded, onClick }: Readonly<NavToggleProps>) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

export default NavToggle;
