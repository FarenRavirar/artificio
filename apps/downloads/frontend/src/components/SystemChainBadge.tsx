import { Dices } from 'lucide-react';

interface SystemChainBadgeProps {
  systemName?: string | null;
  editionName?: string | null;
  variantName?: string | null;
  className?: string;
}

// T6.2 (spec 086) — badge de sistema proprio do Downloads: nome + cadeia
// sistema > edicao > variante, padrao visual do SystemBadge do mesas
// (pilula, icone de dado como fallback), mas SEM depender do /sys-logos/
// servido pelo frontend do mesas (requisito da fase 6) — este modulo nao
// tem acesso a esses arquivos estaticos.
export function SystemChainBadge({ systemName, editionName, variantName, className = '' }: Readonly<SystemChainBadgeProps>) {
  if (!systemName) return null;

  const chain = [systemName, editionName, variantName].filter((segment): segment is string => Boolean(segment));

  // Texto usa --state-brand-fg, NAO --artificio-brand (#ff5722): o token cru de
  // marca e cor de acento/preenchimento, nao de texto. Sobre superficie clara
  // ele fica ainda mais claro que o #e64a19 ja rejeitado por dar 3.3:1 (achado
  // de review PR #214, CodeRabbit) — --state-brand-fg foi criado nesta mesma
  // spec (packages/ui, spec 087) justamente pra carregar a identidade de marca
  // em texto com contraste, virando com o tema.
  return (
    <span
      className={`flex min-w-0 max-w-full items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-2 py-1 text-[11px] font-semibold tracking-[0.02em] text-[var(--state-brand-fg)] ${className}`}
      title={chain.join(' › ')}
    >
      <Dices className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate whitespace-nowrap">{chain.join(' › ')}</span>
    </span>
  );
}
