/**
 * Fase 6 (spec 096, T6.2/Falha 6): normalizador dos SINAIS do parser que o
 * backend devolve dentro do `table` do parse-preview.
 *
 * O backend calcula as ambiguidades e o que não foi reconhecido
 * (`parseDiscordAnnouncement.ts` → `parseTextForPreview.ts` → rota
 * `/gm/parse-preview`); o front antigo ignorava tudo em silêncio e o mestre
 * não sabia que o parser tinha escolhido por ele (R5: as ambiguidades são
 * EXIBIDAS). Este módulo é a fronteira tipada: dado de API é `unknown` até
 * passar por este guard (mesma regra de normalização do resto do editor) —
 * nunca `as` cego sobre a resposta.
 */

export interface ParserSlotsAmbiguity {
  /** Número lido antes da barra (ou antes do parêntese). */
  first: number | null;
  /** Número lido depois da barra. */
  second: number | null;
}

export interface ParserSignals {
  /**
   * O que o parser NÃO reconheceu (chaves do contrato do backend, ex.:
   * 'system_name', 'day_of_week', 'price_type:ambiguous') — exibidas
   * traduzidas ao mestre, nunca cruas.
   */
  missingFields: string[];
  /** Texto cita gratuidade E cobrança sem padrão reconhecido — parser não decidiu. */
  priceAmbiguous: boolean;
  /** 2+ horários diferentes no anúncio — o parser usou o primeiro. */
  scheduleAmbiguous: boolean;
  /** Par "N/M" sem qualificador — não dá para saber qual número é o quê. */
  slotsAmbiguous: ParserSlotsAmbiguity | null;
  /**
   * Nome de sistema lido do texto que NÃO casou no catálogo (Falha 8 do
   * §Gap 4): o front oferece a sugestão pré-preenchida, sem inventar
   * correspondência.
   */
  rawSystemHint: string | null;
}

/** Sinais vazios — usado quando o payload não traz nenhum sinal. */
export function emptyParserSignals(): ParserSignals {
  return {
    missingFields: [],
    priceAmbiguous: false,
    scheduleAmbiguous: false,
    slotsAmbiguous: null,
    rawSystemHint: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lista de strings (chaves de missing_fields) — entradas não-string saem. */
function stringListValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Extrai os sinais do objeto cru do preview (o `data.table` moldado que o
 * ParsePreviewTextArea repassa em `result.data`). Devolve `null` quando a
 * fonte não é objeto — o chamador trata como "sem sinais".
 */
export function parseParserSignals(raw: unknown): ParserSignals | null {
  if (!isRecord(raw)) return null;

  const slotsRaw = raw._slots_ambiguity;
  const slotsAmbiguous: ParserSlotsAmbiguity | null = isRecord(slotsRaw)
    ? {
        first: typeof slotsRaw.first === 'number' ? slotsRaw.first : null,
        second: typeof slotsRaw.second === 'number' ? slotsRaw.second : null,
      }
    : null;

  const rawSystemHint =
    typeof raw.raw_system_hint === 'string' && raw.raw_system_hint.trim()
      ? raw.raw_system_hint.trim()
      : null;

  return {
    missingFields: stringListValue(raw.missing_fields),
    priceAmbiguous: raw._price_ambiguity === true,
    scheduleAmbiguous: raw._schedule_ambiguity === true,
    slotsAmbiguous,
    rawSystemHint,
  };
}
