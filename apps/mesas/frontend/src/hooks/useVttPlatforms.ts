import { useState, useEffect } from 'react';

export interface VttPlatform {
  id: string;
  name: string;
  slug: string;
  logo_filename: string | null;
  website_url: string | null;
  sort_order: number;
}

/**
 * Hook para buscar lista de plataformas VTT ativas
 * Usado no formulário de criação de mesa
 */
export function useVttPlatforms() {
  const [platforms, setPlatforms] = useState<VttPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch('/api/v1/vtt-platforms');
        
        if (!response.ok) {
          throw new Error('Erro ao buscar plataformas VTT');
        }

        const data = await response.json();
        setPlatforms(data.data || []);
      } catch (err) {
        console.error('[useVttPlatforms] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, []);

  return { platforms, loading, error };
}
