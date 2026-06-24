import { useEffect, useState } from 'react';

export interface InsightMetric {
  id: string;
  slug: string;
  title: string;
  views: number;
  clicks: number;
  contacts: number;
  favorites: number;
}

export interface InsightRecommendation {
  table_slug: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface UseMestreInsightsParams {
  slug?: string;
  canSeeInsights: boolean;
}

interface UseMestreInsightsResult {
  metrics: InsightMetric[];
  recommendations: InsightRecommendation[];
  insightsLoading: boolean;
  /** @deprecated Campo legado mantido para compatibilidade com componentes antigos. */
  insights: string[];
}

import { authGet } from '../services/apiClient';

export function useMestreInsights({
  slug,
  canSeeInsights,
}: UseMestreInsightsParams): UseMestreInsightsResult {
  const [metrics, setMetrics] = useState<InsightMetric[]>([]);
  const [recommendations, setRecommendations] = useState<InsightRecommendation[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      if (!slug || !canSeeInsights) {
        setMetrics([]);
        setRecommendations([]);
        return;
      }

      setInsightsLoading(true);
      try {
        const res = await authGet(`/api/v1/gm/${slug}/insights`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setMetrics(json?.data?.metrics ?? []);
        setRecommendations(json?.data?.recommendations ?? []);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setMetrics([]);
        setRecommendations([]);
      } finally {
        setInsightsLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [slug, canSeeInsights]);

  return {
    metrics,
    recommendations,
    insightsLoading,
    // campo legado para minimizar churn até todos os consumidores migrarem
    insights: metrics.map(
      (m) => `${m.title}: ${m.views} visualizações, ${m.contacts} contatos e ${m.favorites} favoritos.`
    ),
  };
}
