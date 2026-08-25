/**
 * Spec 096 / T4.0k — busca das listas "minhas sugestões" via
 * GET /system-suggestions/mine e GET /scenario-suggestions/mine (API
 * existente, zero endpoint novo). HTTP via utils/authenticatedFetch.
 */
import { useCallback, useEffect, useState } from 'react';
import { authGet } from '../../utils/authenticatedFetch';
import {
  NODE_TYPE_LABELS,
  normalizeScenarioSuggestion,
  normalizeSuggestionList,
  normalizeSystemSuggestion,
  readApiErrorMessage,
  type ScenarioSuggestion,
  type SuggestionStatus,
  type SystemSuggestion,
} from './suggestionModels';

/** Item comum das duas listas — o normalizador de cada endpoint preenche o label do tipo. */
export interface SuggestionListItem {
  id: string;
  name: string;
  kindLabel: string;
  description: string | null;
  status: SuggestionStatus;
  rejectionReason: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
}

export interface SuggestionListState {
  items: SuggestionListItem[];
  loading: boolean;
  error: string | null;
}

const NETWORK_ERROR = 'Falha de conexão ao carregar sugestões. Tente novamente.';
const GENERIC_LOAD_ERROR = 'Erro ao carregar sugestões.';

/**
 * Busca as duas listas em paralelo, com estado independente por endpoint: um
 * 500 no de cenários não esconde os sistemas já carregados (e vice-versa).
 */
export function useMySuggestions() {
  const [systems, setSystems] = useState<SuggestionListState>({ items: [], loading: true, error: null });
  const [scenarios, setScenarios] = useState<SuggestionListState>({ items: [], loading: true, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;

    const loadList = async <T,>(
      endpoint: string,
      normalizeItem: (value: unknown) => T | null,
      toItem: (value: T) => SuggestionListItem,
    ): Promise<SuggestionListState> => {
      try {
        const response = await authGet(endpoint);
        if (!response.ok) {
          return {
            items: [],
            loading: false,
            error: await readApiErrorMessage(response, GENERIC_LOAD_ERROR),
          };
        }
        const payload: unknown = await response.json();
        return {
          items: normalizeSuggestionList(payload, normalizeItem).map(toItem),
          loading: false,
          error: null,
        };
      } catch (error) {
        // AbortError é ruído esperado do dedup de authenticatedFetch
        // (StrictMode/re-render rápido) — mesma leitura do PainelMestrePage;
        // a chamada sobrevivente resolve normal.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return { items: [], loading: true, error: null };
        }
        return { items: [], loading: false, error: NETWORK_ERROR };
      }
    };

    void (async () => {
      const [nextSystems, nextScenarios] = await Promise.all([
        loadList('/api/v1/system-suggestions/mine', normalizeSystemSuggestion, (s: SystemSuggestion): SuggestionListItem => ({
          id: s.id,
          name: s.name,
          kindLabel: NODE_TYPE_LABELS[s.node_type],
          description: s.description,
          status: s.status,
          rejectionReason: s.rejection_reason,
          createdAt: s.created_at,
          reviewedAt: s.reviewed_at,
        })),
        loadList('/api/v1/scenario-suggestions/mine', normalizeScenarioSuggestion, (s: ScenarioSuggestion): SuggestionListItem => ({
          id: s.id,
          name: s.name,
          kindLabel: 'Cenário',
          description: s.description,
          status: s.status,
          rejectionReason: s.rejection_reason,
          createdAt: s.created_at,
          reviewedAt: s.reviewed_at,
        })),
      ]);
      if (!active) return;
      setSystems(nextSystems);
      setScenarios(nextScenarios);
    })();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return { systems, scenarios, reload };
}
