import { useEffect, useState } from 'react';
import type { StyleFacet } from '../services/catalogService';

function normalizeFacets(data: unknown): StyleFacet[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is StyleFacet =>
      typeof item === 'object'
      && item !== null
      && typeof (item as Record<string, unknown>).style === 'string'
      && typeof (item as Record<string, unknown>).count === 'number'
  );
}

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
        const json: unknown = await res.json();
        if (!active) return;
        const data = typeof json === 'object' && json !== null ? (json as Record<string, unknown>).data : undefined;
        setFacets(normalizeFacets(data));
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
