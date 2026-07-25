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

  return (
    <span
      className={`flex min-w-0 max-w-full items-center gap-1 rounded-md border border-white/10 bg-[#13213f] px-2 py-1 text-xs font-semibold text-[var(--color-artificio-orange)] ${className}`}
      title={chain.join(' › ')}
    >
      <Dices className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate whitespace-nowrap">{chain.join(' › ')}</span>
    </span>
  );
}
