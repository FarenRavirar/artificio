import { Dice1 } from 'lucide-react';

interface SystemBadgeProps {
  name: string;
  logoFilename?: string | null;
  websiteUrl?: string | null;
  className?: string;
}

export function SystemBadge({ name, logoFilename, websiteUrl, className = '' }: SystemBadgeProps) {
  const content = (
    <>
      {logoFilename ? (
        <img
          src={`/sys-logos/${logoFilename}`}
          alt={name}
          className="w-3 h-3 shrink-0 object-contain"
          onError={(e) => {
            // Fallback para ícone Dice1 se logo não carregar
            const parent = e.currentTarget.parentElement;
            if (parent) {
              e.currentTarget.style.display = 'none';
              const icon = document.createElement('div');
              icon.innerHTML = '<svg class="w-3 h-3 shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 12h.01"/></svg>';
              parent.insertBefore(icon.firstChild!, e.currentTarget);
            }
          }}
        />
      ) : (
        <Dice1 className="w-3 h-3 shrink-0" />
      )}
      <span className="truncate whitespace-nowrap">{name}</span>
    </>
  );

  const baseClasses = `flex min-w-0 max-w-full items-center gap-1 px-2 py-1 bg-[#13213f] rounded-md text-xs font-semibold text-[var(--color-artificio-orange)] border border-white/10 ${className}`;

  if (websiteUrl) {
    return (
      <a
        href={websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} hover:bg-[#1a2a4a] hover:border-[var(--color-artificio-orange)]/30 hover:underline transition-colors`}
        title={`${name} - Abrir site oficial`}
        onClick={(e) => e.stopPropagation()} // Evita trigger do click do card
      >
        {content}
      </a>
    );
  }

  return (
    <span className={baseClasses} title={name}>
      {content}
    </span>
  );
}
