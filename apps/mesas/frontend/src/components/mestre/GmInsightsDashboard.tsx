import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Eye, MousePointerClick, MessageCircle, BarChart3, AlertCircle, Info } from 'lucide-react';
import { useGmInsights } from '../../hooks/useGmInsights';

export function GmInsightsDashboard() {
  const { data, loading, error } = useGmInsights();
  const [expandedSection, setExpandedSection] = useState<string | null>('tables');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { overview, benchmarks, tables, recommendations } = data;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const severityConfig = {
    high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: '🔴' },
    medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: '🟡' },
    low: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: '🟢' },
  };

  const quartileConfig = {
    q1: { label: 'Q1', text: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-500/40' },
    q2: { label: 'Q2', text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/40' },
    q3: { label: 'Q3', text: 'text-cyan-300', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40' },
    q4: { label: 'Q4', text: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40' },
  } as const;


  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Views */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {overview.total_views.toLocaleString()}
          </div>
          <div className="text-sm text-white/60">Visualizações</div>
        </div>

        {/* Clicks */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <MousePointerClick className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {overview.total_clicks.toLocaleString()}
          </div>
          <div className="text-sm text-white/60">Cliques</div>
        </div>

        {/* Contacts */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <MessageCircle className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {overview.total_contacts.toLocaleString()}
          </div>
          <div className="text-sm text-white/60">Contatos</div>
        </div>

        {/* CTR */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {overview.ctr.toFixed(1)}%
          </div>
          <div className="text-sm text-white/60">Taxa de Clique (CTR)</div>
        </div>
      </div>

      {/* Contexto do benchmark */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-cyan-300 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-white font-medium">Referência da plataforma</p>
            <p className="text-sm text-white/70">{benchmarks.note}</p>
            <p className="text-xs text-white/50">
              Base atual: {benchmarks.sample_size} mesas ativas
              {benchmarks.calculated_at
                ? ` · Atualizado em ${new Date(benchmarks.calculated_at).toLocaleString('pt-BR')}`
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-4">
        {/* Desempenho por Mesa */}
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('tables')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-white">
                📊 Desempenho por Mesa ({tables.length} {tables.length === 1 ? 'mesa' : 'mesas'})
              </span>
            </div>
            {expandedSection === 'tables' ? (
              <ChevronUp className="w-5 h-5 text-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/60" />
            )}
          </button>

          {expandedSection === 'tables' && (
            <div className="p-4 border-t border-white/10">
              {tables.length === 0 ? (
                <p className="text-white/60 text-center py-4">
                  Nenhuma mesa ativa encontrada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-white/60 border-b border-white/10">
                        <th className="pb-3 pr-4">Mesa</th>
                        <th className="pb-3 pr-4 text-right">Views</th>
                        <th className="pb-3 pr-4 text-right">Cliques</th>
                        <th className="pb-3 pr-4 text-right">CTR</th>
                        <th className="pb-3 pr-4 text-right">Contatos</th>
                        <th className="pb-3 text-right">Posição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tables.map((table) => (
                        <tr key={table.id} className="border-b border-white/5 last:border-0">
                          <td className="py-3 pr-4">
                            <Link
                              to={`/mesas/${table.slug}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline transition"
                            >
                              {table.title}
                            </Link>
                            {table.system_name && (
                              <div className="text-xs text-white/40 mt-1">
                                {table.system_name}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right text-white">
                            {table.views}
                          </td>
                          <td className="py-3 pr-4 text-right text-white">
                            {table.clicks}
                          </td>
                          <td className="py-3 pr-4 text-right text-white">
                            {table.ctr.toFixed(1)}%
                          </td>
                          <td className="py-3 pr-4 text-right text-white">
                            {table.contacts}
                          </td>
                          <td className="py-3 text-right">
                            {benchmarks.available && table.benchmark_position ? (
                              <div className="inline-flex flex-col items-end gap-1">
                                <span
                                  className={`text-xs px-2 py-1 rounded-full border ${quartileConfig[table.benchmark_position.views_quartile].bg} ${quartileConfig[table.benchmark_position.views_quartile].border} ${quartileConfig[table.benchmark_position.views_quartile].text}`}
                                >
                                  {quartileConfig[table.benchmark_position.views_quartile].label} · {table.benchmark_position.views_label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-white/50">
                                {table.trend.views_last_7d > 0
                                  ? `+${table.trend.views_last_7d} views (7d)`
                                  : 'Sem dados suficientes'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Breakdown de Cliques */}
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('breakdown')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <MousePointerClick className="w-5 h-5 text-purple-400" />
              <span className="font-semibold text-white">
                🎯 Detalhamento de Cliques
              </span>
            </div>
            {expandedSection === 'breakdown' ? (
              <ChevronUp className="w-5 h-5 text-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/60" />
            )}
          </button>

          {expandedSection === 'breakdown' && (
            <div className="p-4 border-t border-white/10">
              {tables.length === 0 ? (
                <p className="text-white/60 text-center py-4">
                  Nenhum dado de cliques disponível.
                </p>
              ) : (
                <div className="space-y-4">
                  {tables.map((table) => {
                    const totalClicks = table.click_breakdown.refactored_v4 + 
                                       table.click_breakdown.cta_entrar + 
                                       table.click_breakdown.link_vtt;
                    
                    if (totalClicks === 0) return null;

                    return (
                      <div key={table.id} className="space-y-2">
                        <div className="text-sm font-medium text-white">
                          {table.title}
                        </div>
                        <div className="space-y-1">
                          {/* Card do Catálogo */}
                          {table.click_breakdown.refactored_v4 > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                                <div
                                  className="bg-blue-500 h-full flex items-center justify-end pr-2"
                                  style={{ width: `${(table.click_breakdown.refactored_v4 / totalClicks) * 100}%` }}
                                >
                                  <span className="text-xs text-white font-medium">
                                    {table.click_breakdown.refactored_v4}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-white/60 w-32">
                                Card do Catálogo
                              </span>
                            </div>
                          )}

                          {/* Botão Entrar */}
                          {table.click_breakdown.cta_entrar > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                                <div
                                  className="bg-green-500 h-full flex items-center justify-end pr-2"
                                  style={{ width: `${(table.click_breakdown.cta_entrar / totalClicks) * 100}%` }}
                                >
                                  <span className="text-xs text-white font-medium">
                                    {table.click_breakdown.cta_entrar}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-white/60 w-32">
                                Botão "Entrar"
                              </span>
                            </div>
                          )}

                          {/* Link VTT */}
                          {table.click_breakdown.link_vtt > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                                <div
                                  className="bg-purple-500 h-full flex items-center justify-end pr-2"
                                  style={{ width: `${(table.click_breakdown.link_vtt / totalClicks) * 100}%` }}
                                >
                                  <span className="text-xs text-white font-medium">
                                    {table.click_breakdown.link_vtt}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-white/60 w-32">
                                Link VTT
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recomendações */}
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('recommendations')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold text-white">
                💡 Recomendações ({recommendations.length})
              </span>
            </div>
            {expandedSection === 'recommendations' ? (
              <ChevronUp className="w-5 h-5 text-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/60" />
            )}
          </button>

          {expandedSection === 'recommendations' && (
            <div className="p-4 border-t border-white/10">
              {recommendations.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">✨</div>
                  <p className="text-white font-medium mb-2">
                    Suas mesas estão no caminho certo!
                  </p>
                  <p className="text-white/60 text-sm">
                    {benchmarks.available
                      ? 'Seus indicadores estão estáveis em relação à plataforma. Continue os ajustes graduais.'
                      : 'Ainda não há amostra suficiente para comparação ampla. Enquanto isso, acompanhe a tendência semanal das suas mesas.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, index) => {
                    const config = severityConfig[rec.severity];
                    return (
                      <div
                        key={index}
                        className={`${config.bg} border ${config.border} rounded-lg p-4`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{config.icon}</span>
                          <div className="flex-1">
                            <Link
                              to={`/mesas/${rec.table_slug}`}
                              className={`font-medium ${config.text} hover:underline`}
                            >
                              {rec.table_title}
                            </Link>
                            <p className="text-sm text-white/70 mt-1">
                              {rec.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
