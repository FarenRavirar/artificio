import { GestaoShell } from '../../components/GestaoShell';
import { useAdminMetrics } from '../../hooks/useAdminMetrics';

// T6.3 (spec 075) — metricas administrativas completas, nunca expostas fora
// do admin.
export function GestaoMetricasPage() {
  const { data, isLoading } = useAdminMetrics();

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-white">Métricas</h1>
      {data?.note && <p className="mt-2 text-xs text-white/40">{data.note}</p>}

      {isLoading && <p className="mt-4 text-white/60">Carregando...</p>}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="text-white/50">
            <th className="pb-2">Material</th>
            <th className="pb-2">Downloads</th>
            <th className="pb-2">Views</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data?.per_material.map((row) => (
            <tr key={row.material_id} className="text-white/80">
              <td className="py-2">{row.material_title}</td>
              <td className="py-2">{row.total_downloads}</td>
              <td className="py-2">{row.total_views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GestaoShell>
  );
}
