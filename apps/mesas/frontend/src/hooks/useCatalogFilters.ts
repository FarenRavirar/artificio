import { useCallback, useState } from 'react';
import { useUrlState } from './useUrlState';
import type { UrlStateSetter } from './useUrlState';
import { parseCatalogFilters, buildCatalogParams } from '../utils/catalogFilters';
import type { CatalogFilters } from '../services/catalogService';

/**
 * Controle completo dos filtros do catálogo (spec 094, D0.3).
 *
 * A busca geral tem dois estados: `draftSearch` (visual, digitado) e
 * `filters.search` (confirmado, na URL). Digitar só mexe no draft; a promoção
 * para o estado confirmado acontece exclusivamente em `submitSearch`
 * (botão "Buscar" ou Enter). Nenhuma request de mesas é disparada por caractere
 * — o draft não alimenta `filters` até a submissão.
 *
 * Back/forward (ou qualquer mudança externa da URL) sincroniza o draft com o
 * valor confirmado: o efeito abaixo só reage a `filters.search` e escreve em
 * estado local, nunca em `setSearchParams`, então não há loop de navegação.
 */
export interface CatalogFiltersController {
  filters: CatalogFilters;
  setFilters: UrlStateSetter<CatalogFilters>;
  draftSearch: string;
  setDraftSearch: (value: string) => void;
  submitSearch: () => void;
}

export function useCatalogFilters(): CatalogFiltersController {
  const [filters, setFilters] = useUrlState<CatalogFilters>({
    parse: parseCatalogFilters,
    serialize: buildCatalogParams,
  });

  const [draftSearch, setDraftSearch] = useState(filters.search);

  // Back/forward (ou qualquer mudança externa da URL) sincroniza o draft com o
  // valor confirmado. Ajuste durante o render (padrão oficial do React para
  // "ajustar estado quando props mudam"), e não em efeito: escreve apenas em
  // estado local, nunca em `setSearchParams`, então não há loop de navegação —
  // e o React refaz o render antes do commit, sem render extra agendado.
  const [lastConfirmedSearch, setLastConfirmedSearch] = useState(filters.search);
  if (lastConfirmedSearch !== filters.search) {
    setLastConfirmedSearch(filters.search);
    setDraftSearch(filters.search);
  }

  const submitSearch = useCallback(() => {
    const term = draftSearch.trim();
    setFilters((prev) => ({ ...prev, search: term, page: 1 }));
  }, [draftSearch, setFilters]);

  return { filters, setFilters, draftSearch, setDraftSearch, submitSearch };
}
