import { AlertTriangle, Info, CheckCircle2, Lock } from 'lucide-react';
import type { InsightRecommendation } from '../../hooks/useMestreInsights';

interface Props {
  recommendations: InsightRecommendation[];
}

const SEVERITY_META = {
  high: {
    Icon: AlertTriangle,
    label: 'Atenção',
    className: 'recommendation-item--high',
  },
  medium: {
    Icon: Info,
    label: 'Sugestão',
    className: 'recommendation-item--medium',
  },
  low: {
    Icon: CheckCircle2,
    label: 'Dica',
    className: 'recommendation-item--low',
  },
} as const;

export function MestreRecommendationsSection({ recommendations }: Props) {
  if (recommendations.length === 0) return null;

  return (
    <section className="recommendations-section mestre-private-panel mestre-private-panel--recommendations">
      <div className="container mestre-private-panel-container">
        <div className="owner-only-banner">
          <Lock size={14} />
          <span>Visível apenas para você</span>
        </div>

        <h2 className="section-title">Recomendações personalizadas</h2>

        <ul className="recommendations-list">
          {recommendations.map((rec, idx) => {
            const meta = SEVERITY_META[rec.severity];
            const Icon = meta.Icon;
            return (
              <li key={`${rec.table_slug}-${idx}`} className={`recommendation-item ${meta.className}`}>
                <Icon className="recommendation-icon" size={20} />
                <div className="recommendation-body">
                  <span className="recommendation-label">{meta.label}</span>
                  <p className="recommendation-message">{rec.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
