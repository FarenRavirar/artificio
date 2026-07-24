import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { MaterialCard } from '../components/MaterialCard';
import { useMaterialsCatalog } from '../hooks/useMaterialsCatalog';
import { SORT_OPTIONS, type SortOption } from '../types/material';

const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevância',
  recent: 'Mais recentes',
  popular: 'Mais populares',
  name: 'Nome (A-Z)',
};

const SEARCH_DEBOUNCE_MS = 300;

// T4.3 (spec 073) — busca/filtro/ordenacao/paginacao como UNICO contrato de
// URL (criterio de aceite 1 da 073): tudo que o usuario ve na tela cabe em
// query params, compartilhavel via link.
export function CatalogoPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const materialType = searchParams.get('material_type') ?? '';
  const systemId = searchParams.get('system_id') ?? '';
  const editionId = searchParams.get('edition_id') ?? '';
  const sort = (searchParams.get('sort') as SortOption | null) ?? 'recent';
  const page = Number(searchParams.get('page') ?? '1');

  const [searchDraft, setSearchDraft] = useState(q);
  const [lastUrlQ, setLastUrlQ] = useState(q);

  // Reajusta o rascunho durante o render quando a URL muda por fora (voltar
  // no historico, link compartilhado) — padrao React de "ajustar estado
  // durante o render" (sem effect, evita cascata de render; achado de lint
  // react-hooks/set-state-in-effect).
  if (lastUrlQ !== q) {
    setLastUrlQ(q);
    setSearchDraft(q);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchParams(
        (prev) => {
          if (searchDraft === (prev.get('q') ?? '')) return prev;
          const next = new URLSearchParams(prev);
          if (searchDraft) next.set('q', searchDraft);
          else next.delete('q');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchDraft, setSearchParams]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.set('page', '1');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const { data, isLoading, isError } = useMaterialsCatalog({
    q: q || undefined,
    material_type: materialType || undefined,
    system_id: systemId || undefined,
    edition_id: editionId || undefined,
    sort,
    page,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-[var(--fg)]">Catálogo</h1>

        <div className="mb-6 flex flex-wrap gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="sr-only">Buscar materiais</span>
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Buscar por nome ou resumo..."
              className="min-h-[44px] w-full rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:border-artificio-orange focus:outline-none"
            />
          </label>

          <label className="min-w-[160px]">
            <span className="sr-only">Ordenar por</span>
            <select
              value={sort}
              onChange={(event) => updateParam('sort', event.target.value)}
              className="min-h-[44px] w-full rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[var(--fg)] focus:border-artificio-orange focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading && <p className="text-[var(--fg-muted)]">Carregando...</p>}
        {isError && <p className="text-red-400">Falha ao carregar materiais. Tente novamente.</p>}

        {data?.items.length === 0 && (
          <p className="text-[var(--fg-muted)]">Nenhum material encontrado com esses filtros.</p>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((material) => (
                <MaterialCard key={material.id} material={material} />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
                className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--line)] px-4 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[var(--fg-muted)]">
                Página {data.page} de {data.total_pages}
              </span>
              <button
                type="button"
                disabled={page >= data.total_pages}
                onClick={() => updateParam('page', String(page + 1))}
                className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--line)] px-4 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
