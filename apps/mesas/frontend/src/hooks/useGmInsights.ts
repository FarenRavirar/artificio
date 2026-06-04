import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface GmInsightsOverview {
  total_views: number;
  total_clicks: number;
  total_contacts: number;
  total_favorites: number;
  ctr: number;
  contact_rate: number;
}

export interface BenchmarkQuartiles {
  p25: number;
  p50: number;
  p75: number;
}

export interface GmInsightsBenchmarks {
  available: boolean;
  segment: string;
  sample_size: number;
  minimum_sample_size: number;
  calculated_at: string | null;
  note: string;
  metrics: {
    views: BenchmarkQuartiles;
    clicks: BenchmarkQuartiles;
    contacts: BenchmarkQuartiles;
    ctr: BenchmarkQuartiles;
  } | null;
}

export interface TableInsight {
  id: string;
  slug: string;
  title: string;
  status: string;
  system_name: string | null;
  views: number;
  clicks: number;
  contacts: number;
  favorites: number;
  ctr: number;
  click_breakdown: {
    refactored_v4: number;
    cta_entrar: number;
    link_vtt: number;
  };
  benchmark_position: {
    views_quartile: 'q1' | 'q2' | 'q3' | 'q4';
    clicks_quartile: 'q1' | 'q2' | 'q3' | 'q4';
    contacts_quartile: 'q1' | 'q2' | 'q3' | 'q4';
    ctr_quartile: 'q1' | 'q2' | 'q3' | 'q4';
    views_label: string;
  } | null;
  trend: {
    views_last_7d: number;
  };
}

export interface Recommendation {
  severity: 'high' | 'medium' | 'low';
  table_slug: string;
  table_title: string;
  message: string;
}

export interface GmInsightsData {
  overview: GmInsightsOverview;
  benchmarks: GmInsightsBenchmarks;
  tables: TableInsight[];
  recommendations: Recommendation[];
}

export function useGmInsights() {
  const [data, setData] = useState<GmInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE}/api/v1/gm/insights`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Perfil de mestre não encontrado');
          }
          throw new Error('Erro ao carregar insights');
        }

        const insights = await response.json();
        setData(insights);
      } catch (err: unknown) {
        console.error('[useGmInsights]', err);
        setError(err instanceof Error && err.message ? err.message : 'Erro ao carregar insights');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

  return { data, loading, error };
}
