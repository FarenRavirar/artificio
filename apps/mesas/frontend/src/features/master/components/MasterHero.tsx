import type { MasterViewModel } from '../types/masterView.types';

interface MasterHeroProps {
  vm: MasterViewModel;
}

/**
 * Hero do perfil do mestre
 * 
 * Responsabilidades:
 * - Identidade visual (avatar + banner)
 * - Nome do mestre
 * - Badge Covil do Lich (certificação)
 */
export function MasterHero({ vm }: MasterHeroProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5">
      {/* Banner (opcional) */}
      {vm.banner && (
        <div className="w-full h-48 overflow-hidden">
          <img 
            src={vm.banner} 
            alt={`Banner de ${vm.name}`}
            className="w-full h-full object-cover" 
          />
        </div>
      )}
      
      {/* Avatar + Nome + Covil */}
      <div className="p-6 flex items-center gap-6">
        <img
          src={vm.avatar}
          alt={vm.name}
          className="w-24 h-24 rounded-full border-2 border-white/20 object-cover"
        />
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{vm.name}</h1>
          
          {vm.isCovil && (
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-400/30">
              <img
                src="https://covildolich.com/wp-content/uploads/2025/09/Mestres.webp"
                alt="Covil do Lich"
                className="w-5 h-5 rounded object-cover"
                onError={(e) => {
                  // Fallback para emoji se imagem falhar
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-purple-300 text-sm font-medium">Mestre do Covil do Lich</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
