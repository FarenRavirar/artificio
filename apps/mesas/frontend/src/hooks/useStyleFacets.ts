import { useEffect, useState } from 'react';
import type { StyleFacet } from '../services/catalogService';

/**
 * Estilos reais em uso pelas mesas ativas, ordenados por frequência.
 * Substitui lista fixa: reflete o que os mestres de fato cadastram.
 */
export function useStyleFacets() {
  const [facets, setFacets] = useState<StyleFacet[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch('/api/v1/tables/style-facets');
        if (!res.ok) throw new Error(`Erro ao carregar estilos (HTTP ${res.status})`);
        const json = await res.json();
        if (!active) return;
        setFacets(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        if (!active) return;
        console.error('[useStyleFacets]', err);
        setError('Não foi possível carregar os estilos agora.');
      }
    })();

    return () => { active = false; };
  }, []);

  return { facets, error };
}
