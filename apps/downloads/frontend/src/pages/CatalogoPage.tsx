import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ActiveFilterChips, type ActiveFilter } from '../components/ActiveFilterChips';
import { CatalogFilterSidebar } from '../components/CatalogFilterSidebar';
import { CatalogShowcase, type ShelfDefinition } from '../components/CatalogShowcase';
import { FilterPills } from '../components/FilterPills';
import { MaterialCard } from '../components/MaterialCard';
import { useCatalogSystems } from '../hooks/useCatalogSystems';
import { useMaterialFacets } from '../hooks/useMaterialFacets';
import { useMaterialsCatalog } from '../hooks/useMaterialsCatalog';
import { SORT_OPTIONS, type SortOption } from '../types/material';

const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevância',
  recent: 'Mais recentes',
  popular: 'Mais populares',
  // Spec 087 (T2.6) — mesmos criterios das prateleiras da vitrine, com o mesmo
  // nome: o usuario que clica em "Ver tudo" numa prateleira cai no modo
  // resultado com essa opcao ja selecionada no dropdown, e reconhece de onde
  // veio. Rotulo diferente aqui quebraria essa continuidade.
  trending: 'Mais visitados',
  rating: 'Mais bem avaliados',
  name: 'Nome (A-Z)',
};

// Spec 087 (T2.4) — as 3 prateleiras da vitrine. `sort` e a mesma chave do
// contrato de URL, entao "Ver tudo" e so `?sort=<...>`.
const SHELVES: readonly ShelfDefinition[] = [
  { id: 'recentes', title: 'Recém adicionados', sort: 'recent' },
  { id: 'visitados', title: 'Mais visitados', sort: 'trending' },
  { id: 'avaliados', title: 'Mais bem avaliados', sort: 'rating' },
];

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
      // Achado real (review PR #208, CodeRabbit): trocar de sistema sem
      // limpar edition_id deixava a URL com edicao de outro sistema presa
      // (filtro invalido, sidebar ja escondia a opcao mas a URL mantinha).
      if (key === 'system_id') next.delete('edition_id');
      if (key !== 'page') next.set('page', '1');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Spec 087 (T2.2) — modo vitrine vs. modo resultado.
  //
  // A rota e UMA so (decisao central da spec: home = catalogo). O que muda o
  // modo e a ausencia de intencao do usuario: sem busca e sem filtro, nao ha
  // "resultado" a mostrar — ha um acervo a apresentar. Nota: `sort` NAO entra
  // nessa conta de proposito. Trocar a ordenacao e navegar pela vitrine, nao
  // buscar; se `sort` derrubasse o modo, clicar em "Ver tudo" numa prateleira
  // pareceria uma busca vazia.
  const isBrowsing = !q && !materialType && !systemId && !editionId;

  const { data, isLoading, isError } = useMaterialsCatalog(
    {
      q: q || undefined,
      material_type: materialType || undefined,
      system_id: systemId || undefined,
      edition_id: editionId || undefined,
      sort,
      page,
    },
    { enabled: !isBrowsing },
  );

  const { data: facets } = useMaterialFacets();
  const { data: systems } = useCatalogSystems();
  const systemsById = new Map((systems ?? []).map((system) => [system.id, system]));

  // T8.4 — chips derivados diretamente dos query params (D073, contrato
  // unico); remover um chip so atualiza a URL (updateParam), que ja dispara
  // o refetch da lista.
  const activeFilters: ActiveFilter[] = [];
  const activePillLabels: Partial<Record<'material_type' | 'system_id' | 'edition_id', string>> = {};
  if (materialType) {
    const label = facets?.material_types.find((option) => option.id === materialType)?.name ?? materialType;
    activeFilters.push({ key: 'material_type', label: 'Tipo', value: label });
    activePillLabels.material_type = label;
  }
  if (systemId) {
    const label = systemsById.get(systemId)?.name ?? systemId;
    activeFilters.push({ key: 'system_id', label: 'Sistema', value: label });
    activePillLabels.system_id = label;
  }
  if (editionId) {
    const label = systemsById.get(editionId)?.name ?? editionId;
    activeFilters.push({ key: 'edition_id', label: 'Edição', value: label });
    activePillLabels.edition_id = label;
  }

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
              placeholder="Buscar por título, autor ou sistema"
              className="min-h-[44px] w-full rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:border-artificio-orange focus:outline-none"
            />
          </label>

          {/* Ordenacao so aparece no modo resultado: na vitrine, cada
              prateleira JA e um criterio de ordenacao, entao um dropdown
              global ali competiria com elas dizendo a mesma coisa. */}
          {!isBrowsing && (
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
          )}
        </div>

        {isBrowsing ? (
          <>
            <div className="mb-8">
              <FilterPills
                values={{ material_type: materialType, system_id: systemId, edition_id: editionId }}
                onChange={updateParam}
                activeLabels={activePillLabels}
              />
            </div>
            <CatalogShowcase shelves={SHELVES} />
          </>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <CatalogFilterSidebar
              values={{ material_type: materialType, system_id: systemId, edition_id: editionId }}
              onChange={updateParam}
            />

            <div className="min-w-0 flex-1">
              <ActiveFilterChips filters={activeFilters} onRemove={(key) => updateParam(key, '')} />

              {isLoading && <p className="text-[var(--fg-muted)]">Carregando...</p>}
              {isError && <p className="text-red-400">Falha ao carregar materiais. Tente novamente.</p>}

              {data?.items.length === 0 && (
                <p className="text-[var(--fg-muted)]">
                  Nenhum material com esses filtros. Tente remover um filtro ou buscar outro termo.
                </p>
              )}

              {data && data.items.length > 0 && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          </div>
        )}
      </div>
    </AppShell>
  );
}
