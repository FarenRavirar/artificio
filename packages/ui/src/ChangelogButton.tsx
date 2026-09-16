/**
 * Botão de "Novidades" (changelog) do header (T7.2, spec 102).
 *
 * Mesma razão de existir do `NavToggle`: a marcação (botão + SVG do raio + badge)
 * estava duplicada entre `Header.tsx` e `apps/site/src/components/SiteHeaderIsland.tsx`,
 * que tem header próprio. T7.2 precisa do MESMO botão em dois lugares por header — a
 * barra do desktop e o rodapé do painel mobile —, o que levaria as duas cópias a quatro.
 * Exceção por app é dívida por definição (`AGENTS.md`): mudar o ícone deixaria as outras
 * para trás em silêncio.
 *
 * ⚠️ O rótulo é "Novidades" nos dois headers, e o guard do `site` o procura por esse
 * nome acessível (`SiteHeader.estrutura.test.tsx`). O `Header` do pacote usava
 * "Changelog" até T7.2; unificado aqui porque é o texto que o usuário lê, e um mesmo
 * controle com dois nomes acessíveis é o tipo de divergência que a regra de
 * compartilhado existe para impedir.
 *
 * Componente de APRESENTAÇÃO: não conhece modal nem estado de "visto" — quem abre e
 * quem marca como lido continua sendo o header que o usa.
 */
export interface ChangelogButtonProps {
  /** Mostra o ponto de novidade não vista. */
  hasBadge?: boolean;
  onClick: () => void;
}

export function ChangelogButton({ hasBadge = false, onClick }: Readonly<ChangelogButtonProps>) {
  return (
    <button
      type="button"
      className="artificio-header-action"
      aria-label="Novidades"
      title="Novidades"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8.56 3.69a9 9 0 0 0-2.92 1.95" />
        <path d="M3.69 8.56A9 9 0 0 0 3 12" />
        <path d="M8.56 20.31A9 9 0 0 0 12 21" />
        <path d="M20.31 15.44A9 9 0 0 0 21 12" />
        <polygon points="13 2 13 13 18 11 13 13 13 2" />
      </svg>
      {hasBadge ? <span className="artificio-header-action-badge" aria-label="Novidade" /> : null}
    </button>
  );
}

export default ChangelogButton;
