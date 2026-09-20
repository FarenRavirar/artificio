import { useEffect, useState } from 'react';
import {
  DAYPART_VALUES,
  WEEKDAY_VALUES,
  isDaypartOption,
  isWeekdayOption,
} from '../utils/catalogFilterOptions';

export type ScheduleFacetCounts = {
  weekdays: Record<string, number>;
  dayparts: Record<string, number>;
  /** `false` até a resposta chegar: sem isso a UI desabilitaria toda opção por
   * dado ausente, escondendo opção que tem mesa. */
  loaded: boolean;
};

/**
 * Contagem de mesas por dia da semana e por faixa de horário.
 *
 * Existe porque a UI mostra a opção vazia com o contador e desabilitada, em vez
 * de removê-la da lista (spec 103, D6 — decisão do mantenedor de 2026-09-18).
 * Sem contagem real não há como distinguir "faixa sem mesa" de "faixa que
 * ninguém consultou", e a política `PUBLIC_*_OPTIONS` (lista hardcoded contra
 * uma medição de 2026-08-21) não serve: ela envelhece sem ninguém notar.
 *
 * Todo dado vindo da rede é `unknown` até passar pelo normalizador
 * (AGENTS.md §Código): a resposta é validada chave por chave, e valor fora do
 * registro canônico é descartado — backend novo não injeta opção na UI.
 */

const EMPTY_COUNTS: ScheduleFacetCounts = { weekdays: {}, dayparts: {}, loaded: false };

/** `[{value,count}]` → `{value: count}`, aceitando só valor do registro. */
function normalizeFacetList(
  raw: unknown,
  isValid: (value: string) => boolean,
): Record<string, number> {
  if (!Array.isArray(raw)) return {};

  const counts: Record<string, number> = {};
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { value, count } = item as Record<string, unknown>;
    if (typeof value !== 'string' || !isValid(value)) continue;
    if (typeof count !== 'number' || !Number.isFinite(count)) continue;
    counts[value] = count;
  }
  return counts;
}

/** Opção do registro que não voltou do GROUP BY tem zero mesas, não ausência. */
function withExplicitZeros(
  counts: Record<string, number>,
  canonical: readonly string[],
): Record<string, number> {
  const complete: Record<string, number> = {};
  for (const value of canonical) {
    complete[value] = counts[value] ?? 0;
  }
  return complete;
}

export function useScheduleFacets() {
  const [counts, setCounts] = useState<ScheduleFacetCounts>(EMPTY_COUNTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch('/api/v1/tables/schedule-facets');
        if (!res.ok) throw new Error(`Erro ao carregar agenda (HTTP ${res.status})`);
        const json: unknown = await res.json();
        if (!active) return;

        const data = typeof json === 'object' && json !== null
          ? (json as Record<string, unknown>).data
          : undefined;
        if (typeof data !== 'object' || data === null) {
          throw new Error('Envelope da agenda sem `data`');
        }
        const payload = data as Record<string, unknown>;
        // `loaded` só vira `true` com as DUAS listas em forma de array: o zero
        // de `withExplicitZeros` significa "opção sem mesa", e o picker
        // desabilita a opção com zero. Payload malformado produz o mesmo zero
        // sem nenhuma contagem ter sido medida, o que desabilitaria a lista
        // inteira em cima de dado que não existe (achado P2 do Codex na PR
        // #327). Forma inválida é falha, e falha cai no `catch`, onde tudo
        // segue clicável.
        if (!Array.isArray(payload.weekdays) || !Array.isArray(payload.dayparts)) {
          throw new Error('Agenda sem as listas `weekdays` e `dayparts`');
        }

        setCounts({
          weekdays: withExplicitZeros(
            normalizeFacetList(payload.weekdays, isWeekdayOption),
            WEEKDAY_VALUES,
          ),
          dayparts: withExplicitZeros(
            normalizeFacetList(payload.dayparts, isDaypartOption),
            DAYPART_VALUES,
          ),
          loaded: true,
        });
      } catch (err) {
        if (!active) return;
        console.error('[useScheduleFacets]', err);
        // Falha de rede não desabilita filtro: `loaded` fica `false` e todas as
        // opções seguem clicáveis, sem contador. Filtro sem número é pior que
        // filtro que some.
        setError('Não foi possível carregar a agenda agora.');
      }
    })();

    return () => { active = false; };
  }, []);

  return { counts, error };
}
