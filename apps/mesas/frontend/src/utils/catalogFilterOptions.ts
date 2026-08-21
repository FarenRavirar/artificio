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

export function pickOptional<T extends string>(value: string, valid: readonly T[]): T | '' {
  return value !== '' && (valid as readonly string[]).includes(value) ? (value as T) : '';
}

type ActiveCatalogFilters = Pick<
  CatalogFilters,
  'search' | 'system' | 'modality' | 'priceType' | 'experience' | 'type' | 'seal' | 'styles' | 'sort'
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
  return scalarCount + filters.styles.length;
}

export function hasActiveCatalogFilters(filters: ActiveCatalogFilters): boolean {
  return activeCatalogScalarValues(filters).some(Boolean) || filters.styles.length > 0;
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
export function normalizeStyles(styles: readonly string[]): string[] {
  return [
    ...new Set(
      styles
        .map((style) => style.trim())
        .filter((style) => style.length > 0 && style.length <= 50)
    ),
  ].sort((left, right) => left.localeCompare(right));
}
