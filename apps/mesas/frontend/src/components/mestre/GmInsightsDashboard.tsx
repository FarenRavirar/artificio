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
        <div className="animate-spin rounded-[var(--radius-pill)] h-8 w-8 border-b-2 border-[var(--fg-muted)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)] rounded-[var(--radius-md)] p-6 text-center">
        <AlertCircle className="w-8 h-8 text-[var(--state-danger-fg)] mx-auto mb-2" />
        <p className="text-[var(--state-danger-fg)]">{error}</p>
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
    high: { bg: 'bg-[var(--state-danger-bg)]', border: 'border-[var(--state-danger-line)]', text: 'text-[var(--state-danger-fg)]', icon: '' },
    medium: { bg: 'bg-[var(--state-warning-bg)]', border: 'border-[var(--state-warning-line)]', text: 'text-[var(--state-warning-fg)]', icon: '' },
    low: { bg: 'bg-[var(--state-info-bg)]', border: 'border-[var(--state-info-line)]', text: 'text-[var(--state-info-fg)]', icon: '' },
  };

  const quartileConfig = {
    q1: { label: 'Q1', text: 'text-[var(--series-4)]', bg: 'bg-[var(--fill-5)]', border: 'border-[var(--border)]' },
    q2: { label: 'Q2', text: 'text-[var(--series-2)]', bg: 'bg-[var(--fill-5)]', border: 'border-[var(--border)]' },
    q3: { label: 'Q3', text: 'text-[var(--series-1)]', bg: 'bg-[var(--fill-5)]', border: 'border-[var(--border)]' },
    q4: { label: 'Q4', text: 'text-[var(--series-3)]', bg: 'bg-[var(--fill-5)]', border: 'border-[var(--border)]' },
  } as const;


  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Views */}
        <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] p-6">
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-5 h-5 text-[var(--series-1)]" />
          </div>
          <div className="text-[length:var(--text-display)] leading-[var(--leading-display)] font-[var(--weight-strong)] text-[var(--fg)] mb-1">
            {overview.total_views.toLocaleString()}
          </div>
          <div className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)]">Visualizações</div>
        </div>

        {/* Clicks */}
        <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] p-6">
          <div className="flex items-center justify-between mb-2">
            <MousePointerClick className="w-5 h-5 text-[var(--series-2)]" />
          </div>
          <div className="text-[length:var(--text-display)] leading-[var(--leading-display)] font-[var(--weight-strong)] text-[var(--fg)] mb-1">
            {overview.total_clicks.toLocaleString()}
          </div>
          <div className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)]">Cliques</div>
        </div>

        {/* Contacts */}
        <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] p-6">
          <div className="flex items-center justify-between mb-2">
            <MessageCircle className="w-5 h-5 text-[var(--series-3)]" />
          </div>
          <div className="text-[length:var(--text-display)] leading-[var(--leading-display)] font-[var(--weight-strong)] text-[var(--fg)] mb-1">
            {overview.total_contacts.toLocaleString()}
          </div>
          <div className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)]">Contatos</div>
        </div>

        {/* CTR */}
        <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] p-6">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-[var(--fg-muted)]" />
          </div>
          <div className="text-[length:var(--text-display)] leading-[var(--leading-display)] font-[var(--weight-strong)] text-[var(--fg)] mb-1">
            {overview.ctr.toFixed(1)}%
          </div>
          <div className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)]">Taxa de Clique (CTR)</div>
        </div>
      </div>

      {/* Contexto do benchmark */}
      <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[var(--fg-muted)] mt-0.5" />
          <div className="space-y-1">
            <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg)] font-[var(--weight-medium)]">Referência da plataforma</p>
            <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-soft)]">{benchmarks.note}</p>
            <p className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-faint)]">
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
        <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
          <button
            onClick={() => toggleSection('tables')}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--fill-5)] transition"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-[var(--fg-muted)]" />
              <span className="font-[var(--weight-strong)] text-[var(--fg)]">
                📊 Desempenho por Mesa ({tables.length} {tables.length === 1 ? 'mesa' : 'mesas'})
              </span>
            </div>
            {expandedSection === 'tables' ? (
              <ChevronUp className="w-5 h-5 text-[var(--fg-low)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--fg-low)]" />
            )}
          </button>

          {expandedSection === 'tables' && (
            <div className="p-4 border-t border-[var(--border)]">
              {tables.length === 0 ? (
                <p className="text-[var(--fg-low)] text-center py-4">
                  Nenhuma mesa ativa encontrada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)] border-b border-[var(--border)]">
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
                        <tr key={table.id} className="border-b border-[var(--border-soft)] last:border-0">
                          <td className="py-3 pr-4">
                            <Link
                              to={`/mesas/${table.slug}`}
                              className="text-[var(--artificio-brand)] hover:underline transition"
                            >
                              {table.title}
                            </Link>
                            {table.system_name && (
                              <div className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-ghost)] mt-1">
                                {table.system_name}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right text-[var(--fg)]">
                            {table.views}
                          </td>
                          <td className="py-3 pr-4 text-right text-[var(--fg)]">
                            {table.clicks}
                          </td>
                          <td className="py-3 pr-4 text-right text-[var(--fg)]">
                            {table.ctr.toFixed(1)}%
                          </td>
                          <td className="py-3 pr-4 text-right text-[var(--fg)]">
                            {table.contacts}
                          </td>
                          <td className="py-3 text-right">
                            {benchmarks.available && table.benchmark_position ? (
                              <div className="inline-flex flex-col items-end gap-1">
                                <span
                                  className={`text-[length:var(--text-label)] leading-[var(--leading-label)] px-2 py-1 rounded-[var(--radius-pill)] border ${quartileConfig[table.benchmark_position.views_quartile].bg} ${quartileConfig[table.benchmark_position.views_quartile].border} ${quartileConfig[table.benchmark_position.views_quartile].text}`}
                                >
                                  {quartileConfig[table.benchmark_position.views_quartile].label} · {table.benchmark_position.views_label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-faint)]">
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
        <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
          <button
            onClick={() => toggleSection('breakdown')}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--fill-5)] transition"
          >
            <div className="flex items-center gap-3">
              <MousePointerClick className="w-5 h-5 text-[var(--series-2)]" />
              <span className="font-[var(--weight-strong)] text-[var(--fg)]">
                🎯 Detalhamento de Cliques
              </span>
            </div>
            {expandedSection === 'breakdown' ? (
              <ChevronUp className="w-5 h-5 text-[var(--fg-low)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--fg-low)]" />
            )}
          </button>

          {expandedSection === 'breakdown' && (
            <div className="p-4 border-t border-[var(--border)]">
              {tables.length === 0 ? (
                <p className="text-[var(--fg-low)] text-center py-4">
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
                        <div className="text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-medium)] text-[var(--fg)]">
                          {table.title}
                        </div>
                        <div className="space-y-1">
                          {/* Card do Catálogo */}
                          {table.click_breakdown.refactored_v4 > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[var(--fill-5)] rounded-[var(--radius-pill)] h-6 overflow-hidden">
                                <div
                                  className="artificio-series-1 h-full flex items-center justify-end pr-2"
                                  style={{ width: `${(table.click_breakdown.refactored_v4 / totalClicks) * 100}%` }}
                                >
                                  <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg)] font-[var(--weight-medium)]">
                                    {table.click_breakdown.refactored_v4}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-low)] w-32">
                                Card do Catálogo
                              </span>
                            </div>
                          )}

                          {/* Botão Entrar */}
                          {table.click_breakdown.cta_entrar > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[var(--fill-5)] rounded-[var(--radius-pill)] h-6 overflow-hidden">
                                <div
                                  className="artificio-series-2 h-full flex items-center justify-end pr-2"
                                  style={{ width: `${(table.click_breakdown.cta_entrar / totalClicks) * 100}%` }}
                                >
                                  <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg)] font-[var(--weight-medium)]">
                                    {table.click_breakdown.cta_entrar}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-low)] w-32">
                                Botão "Entrar"
                              </span>
                            </div>
                          )}

                          {/* Link VTT */}
                          {table.click_breakdown.link_vtt > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[var(--fill-5)] rounded-[var(--radius-pill)] h-6 overflow-hidden">
                                <div
                                  className="artificio-series-3 h-full flex items-center justify-end pr-2"
                                  style={{ width: `${(table.click_breakdown.link_vtt / totalClicks) * 100}%` }}
                                >
                                  <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg)] font-[var(--weight-medium)]">
                                    {table.click_breakdown.link_vtt}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-low)] w-32">
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
        <div className="bg-[var(--fill-5)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
          <button
            onClick={() => toggleSection('recommendations')}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--fill-5)] transition"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--state-warning-fg)]" />
              <span className="font-[var(--weight-strong)] text-[var(--fg)]">
                💡 Recomendações ({recommendations.length})
              </span>
            </div>
            {expandedSection === 'recommendations' ? (
              <ChevronUp className="w-5 h-5 text-[var(--fg-low)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--fg-low)]" />
            )}
          </button>

          {expandedSection === 'recommendations' && (
            <div className="p-4 border-t border-[var(--border)]">
              {recommendations.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-[length:var(--text-display)] leading-[var(--leading-display)] mb-2">✨</div>
                  <p className="text-[var(--fg)] font-[var(--weight-medium)] mb-2">
                    Suas mesas estão no caminho certo!
                  </p>
                  <p className="text-[var(--fg-low)] text-[length:var(--text-support)] leading-[var(--leading-support)]">
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
                        className={`${config.bg} border ${config.border} rounded-[var(--radius-md)] p-4`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-[length:var(--text-title)] leading-[var(--leading-title)]">{config.icon}</span>
                          <div className="flex-1">
                            <Link
                              to={`/mesas/${rec.table_slug}`}
                              className={`font-[var(--weight-medium)] ${config.text} hover:underline`}
                            >
                              {rec.table_title}
                            </Link>
                            <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-soft)] mt-1">
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
