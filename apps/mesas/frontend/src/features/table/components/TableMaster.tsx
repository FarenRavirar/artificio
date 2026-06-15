import type { TableViewModel } from '../types/tableView.types';

interface TableMasterProps {
  vm: TableViewModel;
}

/**
 * Informações sobre o mestre
 * Covil do Lich entra AQUI (badge de confiança do mestre)
 * Base para futura página de perfil do mestre
 */
export function TableMaster({ vm }: TableMasterProps) {
  if (!vm.visibility.showMaster || !vm.masterName) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--fill-subtle)] p-5">
      <h2 className="text-lg font-bold mb-4">🎭 Sobre o Mestre</h2>
      
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {vm.masterAvatar && (
          <img
            src={vm.masterAvatar}
            alt={vm.masterName}
            className="w-16 h-16 rounded-full border-2 border-[var(--line-strong)]"
          />
        )}
        
        <div className="flex-1">
          {/* Nome */}
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-[var(--fg)] text-lg">
              {vm.masterName}
            </p>
            
            {/* Badge Covil do Lich (confiança do mestre) */}
            {vm.certifications.covil && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[rgba(168,85,247,0.20)] border border-[rgba(168,85,247,0.30)]">
                <img
                  src="https://covildolich.com/wp-content/uploads/2025/09/Mestres.webp"
                  alt="Covil do Lich"
                  className="w-5 h-5 rounded object-cover"
                  onError={(e) => {
                    // Fallback para ícone se imagem falhar
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="text-[var(--special)] text-xs font-semibold">Mestre do Covil do Lich</span>
              </span>
            )}
          </div>

          {/* Bio */}
          {vm.masterBio && (
            <p className="text-[var(--fg-muted)] text-sm leading-relaxed whitespace-pre-wrap">
              {vm.masterBio}
            </p>
          )}

          {/* Link para perfil (futuro) */}
          {vm.masterSlug && (
            <a
              href={`/mestre/${vm.masterSlug}`}
              className="inline-block mt-3 text-sm text-[var(--state-warning-fg)] hover:text-[var(--state-warning-fg)] transition"
            >
              Ver perfil completo →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
