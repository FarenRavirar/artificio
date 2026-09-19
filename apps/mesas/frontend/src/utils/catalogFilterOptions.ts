/**
 * Fonte única de valores, labels e guards dos filtros do catálogo (spec 094, R6).
 *
 * Contrato: todo valor válido de modalidade, preço, experiência, selo, tipo,
 * público e sort reside neste módulo — a UI (CatalogoPage, ResultsHeader,
 * ActiveFiltersChips), o parser/builder de URL (catalogFilters.ts) e o mapper
 * de query (catalogService.ts) importam daqui. Manter uma segunda lista de
 * valores válidos em qualquer outro arquivo é proibido por R6.
 *
 * `type` é a única faceta habilitada pela medição T0.2a (2026-08-21);
 * `audience`, `state` e `city` foram reprovadas e não entram em
 * `CatalogFilters`/URL/query. `featured` nunca entra (D0.2).
 *
 * Público (`livre | adultos`) permanece no registro canônico mesmo sem faceta
 * ativa: o critério de aceite 7 exige que o contrato conheça os valores, ainda
 * que a UI não os exponha hoje. O mesmo vale para as opções de tipo sem
 * resultado público (`one-shot` e `aberta` tiveram 0 na medição T0.2a): a
 * omissão de opções com zero resultados é política de renderização (R22 /
 * Fase 2), não de contrato.
 */
import type {
  CatalogFilters,
  ExperienceLevelOption,
  ModalityOption,
  PriceTypeOption,
  SortOption,
} from '../services/catalogService';
import type { CatalogSeal } from '../types/tables';

export type TableTypeOption = 'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta';
export type AudienceOption = 'livre' | 'adultos';

/**
 * Dia da semana (spec 103, §6.4). O valor de URL é o MESMO texto gravado no
 * banco, com acento — `table_schedules.day_of_week` e `tables.schedule_day_hint`
 * compartilham o domínio literal ('segunda'..'domingo'), verificado nos dois
 * CHECK: `migration_12_table_schedules.sql:16` e
 * `migration_124_table_schedule_tbd.sql:46`. Um código numérico paralelo criaria
 * tradução entre URL e banco, e tradução diverge (AGENTS.md §Compartilhado por
 * padrão). O encode da URL cuida do acento.
 */
export type WeekdayOption =
  | 'segunda'
  | 'terça'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sábado'
  | 'domingo';

/**
 * Faixa de horário (spec 103, §6.5). Ao contrário do dia, a faixa **não** existe
 * no banco: é derivada de `start_time` em runtime, então o valor de URL é nosso e
 * vai sem acento (`manha`), com o acento apenas no label.
 */
export type DaypartOption = 'manha' | 'tarde' | 'noite' | 'madrugada';

/** Sorts finais aprovados (D0.4 / R13). `ending_soon` não existe no contrato. */
export const SORT_OPTIONS: readonly { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Mais relevantes' },
  { value: 'recent', label: 'Mais recentes' },
  { value: 'slots', label: 'Mais vagas' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
];

export const MODALITY_OPTIONS: readonly { value: ModalityOption; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'hibrida', label: 'Híbrida' },
];

export const PRICE_TYPE_OPTIONS: readonly { value: PriceTypeOption; label: string }[] = [
  { value: 'gratuita', label: 'Gratuita' },
  { value: 'paga', label: 'Paga' },
];

export const EXPERIENCE_LEVEL_OPTIONS: readonly { value: ExperienceLevelOption; label: string }[] = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'veterano', label: 'Veterano' },
];

/** Selos sem o `''` — ausência não é opção, é estado vazio do filtro. */
export const SEAL_OPTIONS: readonly { value: Exclude<CatalogSeal, ''>; label: string }[] = [
  { value: 'ddal', label: 'DDAL' },
  { value: 'covil-do-lich', label: 'Covil do Lich' },
];

export const TABLE_TYPE_OPTIONS: readonly { value: TableTypeOption; label: string }[] = [
  { value: 'campanha', label: 'Campanha' },
  { value: 'one-shot', label: 'One-shot' },
  { value: 'oneshot-serie', label: 'Série de one-shots' },
  { value: 'aberta', label: 'Mesa aberta' },
];

export const AUDIENCE_OPTIONS: readonly { value: AudienceOption; label: string }[] = [
  { value: 'livre', label: 'Livre' },
  { value: 'adultos', label: 'Adultos' },
];

/**
 * Ordem da semana começando na segunda — a ordem do calendário, não a do volume
 * de mesas. Ordenar por popularidade faria a lista se reordenar sozinha conforme
 * o acervo muda, e o usuário procura "sábado" onde sábado sempre esteve.
 */
export const WEEKDAY_OPTIONS: readonly { value: WeekdayOption; label: string }[] = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terça', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
  { value: 'sábado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

/**
 * Limites das quatro faixas — 06/12/18/00 (D5, respondida em 2026-09-18).
 *
 * O corte não foi escolhido por preferência: é a convenção brasileira de período
 * do dia (madrugada 0–6, manhã 6–12, tarde 12–18, noite 18–24), registrada no
 * Manual de Comunicação do Senado, e coincide com o corte que plataformas de
 * reserva por período usam em produto (hotelSlots: Morning 6AM–12PM, Afternoon
 * 12PM–6PM, Evening 6PM–12AM, Overnight 12AM–6AM).
 *
 * `startHour` inclusivo, `endHour` exclusivo. As quatro cobrem 24 h sem
 * sobreposição e sem buraco — requisito técnico, não escolha: faixa sobreposta
 * faz a mesma mesa aparecer em duas, e buraco faz mesa sumir de todas. O teste
 * catalogFilterOptions.test.ts assere a cobertura.
 *
 * A faixa se decide pelo INÍCIO da sessão: `start_time` é `NOT NULL`
 * (`migration_12_table_schedules.sql:17`) e `end_time` é nullable (linha 18).
 * Mesa que começa 23h e varre a madrugada conta como noite, não como duas.
 */
export const DAYPART_RANGES: Readonly<Record<DaypartOption, { startHour: number; endHour: number }>> = {
  madrugada: { startHour: 0, endHour: 6 },
  manha: { startHour: 6, endHour: 12 },
  tarde: { startHour: 12, endHour: 18 },
  noite: { startHour: 18, endHour: 24 },
};

/** Ordem cronológica do dia, não por volume — mesmo motivo de WEEKDAY_OPTIONS. */
export const DAYPART_OPTIONS: readonly { value: DaypartOption; label: string }[] = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'madrugada', label: 'Madrugada' },
];

/**
 * Opções visíveis após a medição pública T0.2a/R22 de 2026-08-21. O contrato
 * completo acima continua aceitando URLs legadas; estas listas controlam apenas
 * o que pode ser oferecido como escolha enquanto houver resultado público.
 */
export const PUBLIC_MODALITY_OPTIONS = MODALITY_OPTIONS.filter((option) => option.value === 'online');
export const PUBLIC_EXPERIENCE_LEVEL_OPTIONS = EXPERIENCE_LEVEL_OPTIONS.filter(
  (option) => option.value === 'intermediario' || option.value === 'veterano',
);
export const PUBLIC_SEAL_OPTIONS = SEAL_OPTIONS.filter(() => false);
export const PUBLIC_TABLE_TYPE_OPTIONS = TABLE_TYPE_OPTIONS.filter(
  (option) => option.value === 'campanha' || option.value === 'oneshot-serie',
);

export const PUBLIC_SHORTCUT_OPTIONS = [
  { key: 'shortcut-price-gratuita', kind: 'priceType', value: 'gratuita', label: 'Mesas gratuitas' },
  { key: 'shortcut-modality-online', kind: 'modality', value: 'online', label: 'Online' },
] as const;

// Listas de valores derivadas das mesmas opções — única fonte de verdade dos
// enums aceitos pelo parser (R6). O teste catalogFilterOptions.test.ts falha se
// a UI renderizar um valor que não esteja aqui (e vice-versa).
export const SORT_VALUES: readonly SortOption[] = SORT_OPTIONS.map((option) => option.value);
export const MODALITY_VALUES: readonly ModalityOption[] = MODALITY_OPTIONS.map((option) => option.value);
export const PRICE_TYPE_VALUES: readonly PriceTypeOption[] = PRICE_TYPE_OPTIONS.map((option) => option.value);
export const EXPERIENCE_LEVEL_VALUES: readonly ExperienceLevelOption[] = EXPERIENCE_LEVEL_OPTIONS.map((option) => option.value);
export const SEAL_VALUES: ReadonlyArray<Exclude<CatalogSeal, ''>> = SEAL_OPTIONS.map((option) => option.value);
export const TABLE_TYPE_VALUES: readonly TableTypeOption[] = TABLE_TYPE_OPTIONS.map((option) => option.value);
export const AUDIENCE_VALUES: readonly AudienceOption[] = AUDIENCE_OPTIONS.map((option) => option.value);
export const WEEKDAY_VALUES: readonly WeekdayOption[] = WEEKDAY_OPTIONS.map((option) => option.value);
export const DAYPART_VALUES: readonly DaypartOption[] = DAYPART_OPTIONS.map((option) => option.value);

// Type guards derivados das mesmas listas (sem segunda fonte de valores).
export function isSortOption(value: string): value is SortOption {
  return (SORT_VALUES as readonly string[]).includes(value);
}

export function isModalityOption(value: string): value is ModalityOption {
  return (MODALITY_VALUES as readonly string[]).includes(value);
}

export function isPriceTypeOption(value: string): value is PriceTypeOption {
  return (PRICE_TYPE_VALUES as readonly string[]).includes(value);
}

export function isExperienceLevelOption(value: string): value is ExperienceLevelOption {
  return (EXPERIENCE_LEVEL_VALUES as readonly string[]).includes(value);
}

export function isCatalogSeal(value: string): value is Exclude<CatalogSeal, ''> {
  return (SEAL_VALUES as readonly string[]).includes(value);
}

export function isTableTypeOption(value: string): value is TableTypeOption {
  return (TABLE_TYPE_VALUES as readonly string[]).includes(value);
}

export function isAudienceOption(value: string): value is AudienceOption {
  return (AUDIENCE_VALUES as readonly string[]).includes(value);
}

export function isWeekdayOption(value: string): value is WeekdayOption {
  return (WEEKDAY_VALUES as readonly string[]).includes(value);
}

export function isDaypartOption(value: string): value is DaypartOption {
  return (DAYPART_VALUES as readonly string[]).includes(value);
}

export function pickOptional<T extends string>(value: string, valid: readonly T[]): T | '' {
  return value !== '' && (valid as readonly string[]).includes(value) ? (value as T) : '';
}

type ActiveCatalogFilters = Pick<
  CatalogFilters,
  | 'search'
  | 'system'
  | 'modality'
  | 'priceType'
  | 'experience'
  | 'type'
  | 'seal'
  | 'styles'
  | 'weekdays'
  | 'dayparts'
  | 'sort'
>;

function activeCatalogScalarValues(filters: ActiveCatalogFilters): string[] {
  return [
    filters.search,
    filters.system,
    filters.modality,
    filters.priceType,
    filters.experience,
    filters.type,
    filters.seal,
    filters.sort !== 'popular' ? filters.sort : '',
  ];
}

/** Fonte única para chips, limpeza e estado vazio; sort popular é o default inativo. */
export function activeCatalogFiltersCount(filters: ActiveCatalogFilters): number {
  const scalarCount = activeCatalogScalarValues(filters)
    .reduce((count, value) => count + Number(Boolean(value)), 0);
  return scalarCount + activeCatalogMultiLength(filters);
}

export function hasActiveCatalogFilters(filters: ActiveCatalogFilters): boolean {
  return activeCatalogScalarValues(filters).some(Boolean) || activeCatalogMultiLength(filters) > 0;
}

/**
 * Cada dia e cada faixa marcados contam como um filtro, igual a cada estilo —
 * é o que o badge `advancedCount` já comunica para estilos (E8 da spec 103).
 */
function activeCatalogMultiLength(filters: ActiveCatalogFilters): number {
  return filters.styles.length + filters.weekdays.length + filters.dayparts.length;
}

/**
 * Normalização canônica de estilos (R11): trim, descarte de lixo óbvio (vazio
 * ou gigante) e ordenação determinística com dedupe. Aplicada no parser e no
 * builder da URL e no mapper de query — a mesma seleção produz sempre a mesma
 * string, então URL e cache key não divergem por ordem de clique.
 *
 * O limite de 50 caracteres reflete o parser histórico (estilo é campo livre
 * vindo do backend; a validação real é o filtro SQL). Mantido aqui para não
 * afrouxar o descarte de lixo que já existia.
 */
/**
 * Normalização multivalor de enum fechado (dia e faixa): descarta valor fora do
 * registro, deduplica e ordena pela ORDEM CANÔNICA da lista de opções — não
 * alfabética.
 *
 * Alfabética seria errada aqui: `normalizeStyles` ordena por `localeCompare`
 * porque estilo é campo livre sem ordem natural, mas dia tem ordem de calendário
 * e faixa tem ordem cronológica. Ordenar `sexta,segunda` como `segunda,sexta`
 * mantém a URL estável qualquer que seja a ordem de clique — mesma garantia que
 * R11 dá aos estilos, com o critério certo para lista ordenada.
 */
export function normalizeEnumMulti<T extends string>(
  values: readonly string[],
  canonical: readonly T[],
): T[] {
  const selected = new Set(values.map((value) => value.trim()));
  return canonical.filter((option) => selected.has(option));
}

export function normalizeStyles(styles: readonly string[]): string[] {
  return [
    ...new Set(
      styles
        .map((style) => style.trim())
        .filter((style) => style.length > 0 && style.length <= 50)
    ),
  ].sort((left, right) => left.localeCompare(right));
}
