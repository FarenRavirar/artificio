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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-bold mb-4">🎭 Sobre o Mestre</h2>
      
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {vm.masterAvatar && (
          <img
            src={vm.masterAvatar}
            alt={vm.masterName}
            className="w-16 h-16 rounded-full border-2 border-white/20"
          />
        )}
        
        <div className="flex-1">
          {/* Nome */}
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-white text-lg">
              {vm.masterName}
            </p>
            
            {/* Badge Covil do Lich (confiança do mestre) */}
            {vm.certifications.covil && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-400/30">
                <img
                  src="https://covildolich.com/wp-content/uploads/2025/09/Mestres.webp"
                  alt="Covil do Lich"
                  className="w-5 h-5 rounded object-cover"
                  onError={(e) => {
                    // Fallback para ícone se imagem falhar
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="text-purple-300 text-xs font-semibold">Mestre do Covil do Lich</span>
              </span>
            )}
          </div>

          {/* Bio */}
          {vm.masterBio && (
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
              {vm.masterBio}
            </p>
          )}

          {/* Link para perfil (futuro) */}
          {vm.masterSlug && (
            <a
              href={`/mestre/${vm.masterSlug}`}
              className="inline-block mt-3 text-sm text-orange-400 hover:text-orange-300 transition"
            >
              Ver perfil completo →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
