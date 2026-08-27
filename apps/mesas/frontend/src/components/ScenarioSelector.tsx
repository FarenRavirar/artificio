import { useState, useEffect, useMemo } from 'react';
import { Search, MapPin } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  name_pt: string | null;
  slug: string;
  subgenres: string[];
}

interface ScenarioSelectorProps {
  selectedScenarioId: string | null;
  onSelect: (scenarioId: string | null) => void;
  disabled?: boolean;
}

const normalizeText = (value: string): string => value.trim().toLowerCase();

/**
 * Payload de API é `unknown` até prova de tipo (AGENTS.md §Regras Gerais de
 * Código): `data.data || []` aceitava qualquer coisa não-nula, e um `data`
 * objeto — ou um item sem `subgenres` array — derrubava a tela em
 * `scenarios.filter(...).subgenres.some(...)`. Achado de review (Codex, PR #291).
 */
const normalizeScenarios = (payload: unknown): Scenario[] => {
  if (typeof payload !== 'object' || payload === null) return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return data.flatMap((raw): Scenario[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.name !== 'string') return [];
    return [{
      id: item.id,
      name: item.name,
      name_pt: typeof item.name_pt === 'string' ? item.name_pt : null,
      slug: typeof item.slug === 'string' ? item.slug : '',
      subgenres: Array.isArray(item.subgenres)
        ? item.subgenres.filter((g): g is string => typeof g === 'string')
        : [],
    }];
  });
};

const getDisplayName = (scenario: Scenario, lang: 'en' | 'pt'): string => {
  if (lang === 'pt' && scenario.name_pt) {
    return scenario.name_pt;
  }
  return scenario.name;
};

export const ScenarioSelector = ({
  selectedScenarioId,
  onSelect,
  disabled = false,
}: ScenarioSelectorProps) => {
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState<'en' | 'pt'>('pt');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar cenários da API
  useEffect(() => {
    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/v1/scenarios');
        if (!response.ok) {
          throw new Error('Erro ao buscar cenários');
        }

        const payload: unknown = await response.json();
        setScenarios(normalizeScenarios(payload));
      } catch (err: unknown) {
        console.error('[ScenarioSelector] Erro ao buscar cenários:', err);
        setError(err instanceof Error && err.message ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, []);

  // Sem busca digitada, NENHUM resultado é listado (decisão do mantenedor,
  // 2026-08-27): "não faz sentido ter lista, são cenários demais (…) apenas
  // pesquisar e aparecer na lista o que der match".
  // Antes, o catálogo inteiro era renderizado de saída: 118 itens, 7418px de
  // conteúdo numa caixa de 240px — 30x a altura da caixa, medido no beta. O
  // mestre caçava o cenário rolando uma janelinha dentro de uma página que já
  // rola. É o mesmo padrão que o seletor de SISTEMA ao lado já usa desde a
  // T4.0h-bis: busca primeiro, resultado depois, nunca a árvore inteira (A21).
  // A busca continua casando nome EN, nome PT, slug e subgêneros — o alternador
  // PT/EN só troca o rótulo exibido, nunca o que é pesquisável.
  const searchTerm = search.trim();

  const filteredScenarios = useMemo(() => {
    if (!searchTerm) return [];

    const normalizedSearch = normalizeText(searchTerm);

    return scenarios.filter((scenario) => {
      return normalizeText(scenario.name).includes(normalizedSearch)
        || normalizeText(scenario.name_pt || '').includes(normalizedSearch)
        || normalizeText(scenario.slug).includes(normalizedSearch)
        || scenario.subgenres.some((subgenre) => normalizeText(subgenre).includes(normalizedSearch));
    });
  }, [scenarios, searchTerm]);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);

  const renderResultado = () => {
    if (loading) {
      return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
          Carregando cenários...
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      );
    }

    if (filteredScenarios.length > 0) {
      // `max-h-96` (384px): a barra interna só existe quando uma BUSCA devolve
      // muitos resultados, que é quando rolar de fato ajuda a comparar. Fora
      // isso a caixa não existe na tela — o R1 proíbe a "caixinha que rola
      // dentro da página" como estado permanente, não a lista de uma busca.
      return (
        <div className="max-h-96 space-y-2 overflow-auto pr-1">
          {filteredScenarios.map((scenario) => {
            const isSelected = scenario.id === selectedScenarioId;

            return (
              <button
                type="button"
                key={scenario.id}
                onClick={() => onSelect(isSelected ? null : scenario.id)}
                disabled={disabled}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)]/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                }`}
              >
                <p className="font-semibold">{getDisplayName(scenario, language)}</p>
                {scenario.subgenres.length > 0 && (
                  <p className="text-xs text-white/55 mt-0.5">
                    {scenario.subgenres.join(' · ')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      );
    }

    if (searchTerm) {
      return (
        <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-white/60">
          Nenhum cenário encontrado com esse termo.
        </div>
      );
    }

    // Estado ocioso: sem busca não há lista (ver `filteredScenarios`). O texto
    // precisa dizer o que fazer, senão o campo vazio lê como defeito — é a
    // diferença entre "não achei nada" e "ainda não procurei".
    return (
      <p className="px-1 text-xs text-white/55">
        Digite acima para buscar entre os {scenarios.length} cenários do catálogo.
      </p>
    );
  };

  return (
    <div className="space-y-3">
      {/* Campo de busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cenário (ex: Forgotten Realms, Eberron)..."
            disabled={disabled || loading}
            className="w-full rounded-xl border border-white/15 bg-[var(--surface-input)] py-2.5 pl-9 pr-3 outline-none focus:border-[var(--color-artificio-orange)] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex rounded-xl border border-white/15 bg-[var(--surface-input)] p-1">
          <button
            type="button"
            onClick={() => setLanguage('pt')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              language === 'pt' ? 'bg-[var(--color-artificio-orange)] text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            PT
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              language === 'en' ? 'bg-[var(--color-artificio-orange)] text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Cenário selecionado */}
      {selectedScenario && (
        <div className="rounded-xl border border-[var(--color-artificio-orange)]/30 bg-[var(--color-artificio-orange)]/10 p-4">
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-[var(--color-artificio-orange)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-artificio-orange)]">
                Cenário Selecionado
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {getDisplayName(selectedScenario, language)}
              </p>
              {selectedScenario.subgenres.length > 0 && (
                <p className="mt-1 text-xs text-white/60">
                  {selectedScenario.subgenres.join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              disabled={disabled}
              className="text-xs text-white/60 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {/* Lista de resultados: quatro estados exclusivos, extraídos do ternário
          encadeado que os aninhava (achado de review — Sonar, PR #291). Cada um
          tem nome, e a ordem de precedência fica explícita em vez de implícita
          na indentação. */}
      {renderResultado()}

      {/* Hint */}
      {!selectedScenarioId && !search && (
        <p className="text-xs text-white/50">
          Campo opcional. Cenários são independentes de sistemas (ex: Forgotten Realms pode ser jogado em D&D ou Pathfinder).
        </p>
      )}
    </div>
  );
};
