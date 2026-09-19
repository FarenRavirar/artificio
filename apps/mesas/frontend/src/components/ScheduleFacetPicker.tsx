import type { ScheduleFacetCounts } from '../hooks/useScheduleFacets';
import {
  DAYPART_OPTIONS,
  WEEKDAY_OPTIONS,
  type DaypartOption,
  type WeekdayOption,
} from '../utils/catalogFilterOptions';

/**
 * Dia da semana e faixa de horário (spec 103, §6). UMA definição para desktop e
 * mobile, como manda R15 — o drawer recebe os mesmos props, não um seletor
 * próprio.
 *
 * POLÍTICA DE OPÇÃO VAZIA — exceção deliberada a R22, decidida pelo mantenedor
 * em 2026-09-18 (spec 103, D6):
 *
 * R22 (spec 094) manda omitir opção com zero resultado, e as listas
 * `PUBLIC_*_OPTIONS` fazem isso para modalidade, tipo e experiência. Aqui a
 * opção vazia aparece com o contador e fica desabilitada. O motivo é a natureza
 * da lista, não preferência: dia e faixa são listas FECHADAS (7 e 4 itens) que o
 * usuário conhece de fora do produto. Sumir com "madrugada" de uma lista de
 * quatro faz o controle parecer quebrado — o usuário procura o que sabe que
 * existe. Estilo é lista ABERTA e longa (48 valores na medição de 2026-07-18),
 * onde omitir o vazio encurta uma lista que ninguém memorizou.
 *
 * É também o que o NN/g recomenda para busca facetada: mostrar a faceta sem
 * resultado com o contador, ou desabilitá-la, em vez de removê-la — remover
 * esconde que a dimensão existe.
 *
 * Medido em produção (2026-09-18): madrugada tem 0 mesas, contra noite 55,
 * tarde 11 e manhã 2. Nenhum dos 7 dias tem zero.
 */

export type ScheduleFacetPickerProps = Readonly<{
  weekdays: readonly WeekdayOption[];
  dayparts: readonly DaypartOption[];
  counts: ScheduleFacetCounts;
  onWeekdayToggle: (weekday: WeekdayOption) => void;
  onDaypartToggle: (daypart: DaypartOption) => void;
  /** Desktop e mobile passam prefixos distintos: as duas superfícies podem
   * coexistir no DOM, e `id` duplicado quebra a associação de `legend`. */
  idPrefix: string;
}>;

// Mesmo token e geometria de foco de `StyleFacetPicker` e `.artificio-button`
// (packages/ui/styles.css). Não inventar valor próprio (R: não divergir do
// design system).
const FOCUS_RING =
  ' focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]';

function chipClassName(isSelected: boolean, isEmpty: boolean): string {
  // `min-h-11` = 44px: alvo de toque mínimo no mobile (E9), o mesmo que os
  // controles vizinhos usam via `h-11`.
  const base = `inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 py-1.5 text-xs transition-all whitespace-nowrap${FOCUS_RING}`;

  if (isEmpty) {
    // Desabilitado, mas ainda legível: o contador (0) é a informação. Sem
    // `opacity` baixa demais, que reprovaria contraste (T3 da mesma spec).
    return `${base} cursor-not-allowed border-dashed border-[var(--border)] bg-transparent text-[var(--fg-muted)]`;
  }
  if (isSelected) {
    return `${base} border-[var(--state-brand-line)] bg-[var(--state-brand-bg)] text-[var(--state-brand-fg)]`;
  }
  return `${base} border-transparent bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-strong)]`;
}

type ChipGroupProps<T extends string> = Readonly<{
  legend: string;
  groupId: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  counts: Readonly<Record<string, number>>;
  onToggle: (value: T) => void;
  /** Contagem ainda não carregada: nada é desabilitado por ausência de dado. */
  countsLoaded: boolean;
}>;

function ChipGroup<T extends string>({
  legend,
  groupId,
  options,
  selected,
  counts,
  onToggle,
  countsLoaded,
}: ChipGroupProps<T>) {
  return (
    // `fieldset`/`legend` dá ao leitor de tela o nome do grupo antes dos chips
    // (E9). `role="group"` + `aria-label` seria equivalente; `fieldset` é nativo.
    <fieldset className="min-w-0 border-0 p-0" id={groupId}>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
        {legend}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {options.map(({ value, label }) => {
          const count = counts[value] ?? 0;
          // Antes de a contagem chegar, nada é desabilitado — desabilitar por
          // dado ausente esconderia opção que tem mesa.
          const isEmpty = countsLoaded && count === 0;
          const isSelected = selected.includes(value);

          return (
            <button
              key={value}
              type="button"
              disabled={isEmpty}
              aria-pressed={isSelected}
              onClick={() => onToggle(value)}
              className={chipClassName(isSelected, isEmpty)}
            >
              {label}
              {countsLoaded && (
                <span className="ml-1 text-[var(--fg-muted)]">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ScheduleFacetPicker({
  weekdays,
  dayparts,
  counts,
  onWeekdayToggle,
  onDaypartToggle,
  idPrefix,
}: ScheduleFacetPickerProps) {
  return (
    <div className="space-y-4">
      <ChipGroup
        legend="Dia da semana"
        groupId={`${idPrefix}-weekday`}
        options={WEEKDAY_OPTIONS}
        selected={weekdays}
        counts={counts.weekdays}
        onToggle={onWeekdayToggle}
        countsLoaded={counts.loaded}
      />
      <ChipGroup
        legend="Horário"
        groupId={`${idPrefix}-daypart`}
        options={DAYPART_OPTIONS}
        selected={dayparts}
        counts={counts.dayparts}
        onToggle={onDaypartToggle}
        countsLoaded={counts.loaded}
      />
    </div>
  );
}
