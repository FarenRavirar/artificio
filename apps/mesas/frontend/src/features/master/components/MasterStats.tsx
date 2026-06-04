import type { MasterViewModel } from '../types/masterView.types';

interface MasterStatsProps {
  vm: MasterViewModel;
}

/**
 * Estatísticas do mestre (prova social)
 * 
 * Responsabilidades:
 * - Mostrar credibilidade (mesas criadas, ativas)
 * - Rating (quando disponível)
 * - Total de jogadores (quando disponível)
 * 
 * Regra: Não renderizar "N/A" - ausência ≠ erro
 */
export function MasterStats({ vm }: MasterStatsProps) {
  const stats = [
    { label: 'Mesas criadas', value: vm.stats.tablesCount },
    { label: 'Mesas ativas', value: vm.stats.activeTables },
    vm.stats.totalPlayers !== undefined && { label: 'Jogadores', value: vm.stats.totalPlayers },
    vm.stats.rating !== undefined && { label: 'Avaliação', value: `${vm.stats.rating.toFixed(1)} ⭐` },
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => stat && (
        <StatCard key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-white/60 mt-1">{label}</p>
    </div>
  );
}
