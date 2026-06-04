import { useState, useEffect } from 'react';

export interface CommunicationPlatform {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  sort_order: number;
}

/**
 * Hook para buscar lista de plataformas de comunicação ativas
 * Usado no formulário de criação/edição de mesa
 */
export function useCommunicationPlatforms() {
  const [platforms, setPlatforms] = useState<CommunicationPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch('/api/v1/communication-platforms');

        if (!response.ok) {
          throw new Error('Erro ao buscar plataformas de comunicação');
        }

        const data = await response.json();
        setPlatforms(data.data || []);
      } catch (err) {
        console.error('[useCommunicationPlatforms] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, []);

  return { platforms, loading, error };
}
