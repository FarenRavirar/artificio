import { Eye, MousePointerClick, MessageSquare, Heart, Lock } from 'lucide-react';
import type { InsightMetric } from '../../hooks/useMestreInsights';

interface Props {
  insightsLoading: boolean;
  metrics: InsightMetric[];
}

export function MestreInsightsSection({ insightsLoading, metrics }: Props) {
  // Ordena por views desc para destacar o que mais recebe tráfego
  const sorted = [...metrics].sort((a, b) => b.views - a.views);

  return (
    <section className="insights-section mestre-private-panel mestre-private-panel--insights">
      <div className="container mestre-private-panel-container">
        <div className="owner-only-banner">
          <Lock size={14} />
          <span>Visível apenas para você</span>
        </div>

        <h2 className="section-title">Insights das suas mesas</h2>

        {insightsLoading && (
          <p className="mestre-private-panel-loading">Carregando métricas…</p>
        )}

        {!insightsLoading && sorted.length === 0 && (
          <p className="mestre-private-panel-empty">
            Ainda não há métricas para exibir. Divulgue suas mesas para começar a coletar dados.
          </p>
        )}

        {!insightsLoading && sorted.length > 0 && (
          <div className="insights-grid">
            {sorted.map((m) => {
              const needsAttention = m.views >= 10 && m.contacts === 0;
              return (
                <article
                  key={m.id}
                  className={`insight-card${needsAttention ? ' insight-card--warning' : ''}`}
                >
                  <h3 className="insight-title">{m.title}</h3>
                  <div className="insight-metrics">
                    <div className="metric">
                      <Eye className="metric-icon" />
                      <span className="metric-value">{m.views}</span>
                      <span className="metric-label">Visualizações</span>
                    </div>
                    <div className="metric">
                      <MousePointerClick className="metric-icon" />
                      <span className="metric-value">{m.clicks}</span>
                      <span className="metric-label">Cliques</span>
                    </div>
                    <div className="metric">
                      <MessageSquare className="metric-icon" />
                      <span className="metric-value">{m.contacts}</span>
                      <span className="metric-label">Contatos</span>
                    </div>
                    <div className="metric">
                      <Heart className="metric-icon" />
                      <span className="metric-value">{m.favorites}</span>
                      <span className="metric-label">Favoritos</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
