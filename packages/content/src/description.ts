// ============================================================================
// Normalização de descrição Open Graph — primitivo genérico compartilhado.
// ============================================================================
//
// Causa raiz medida em produção (2026-08-22, bug OG): cadeias de descrição do
// tipo `campoA || campoB || fallback` tratam string só-whitespace como
// conteúdo, porque `"\n"` é truthy em JS. A mesa
// `idade-das-trevas-noites-na-toscana-mt4uezwv` tinha `synopsis = "\n"` e
// `description` com 2618 caracteres: a cadeia escolhia `"\n"`, o truncate
// (que colapsa `\s+`→espaço e faz trim) devolvia `""`, e o preview saía com
// `og:description content=""` — 1 mesa ativa afetada em produção.
//
// A mesma classe de defeito existia em três apps (mesas, downloads e
// glossario), cada um com uma cópia local do padrão. Este helper centraliza
// a normalização para os três: seleção por primeiro candidato não-branco,
// colapso de whitespace, trim e corte opcional em `max` com reticências.
// ============================================================================

export interface NormalizeOgDescriptionOptions {
  /**
   * Tamanho máximo da descrição. `null` desliga o corte (o valor é devolvido
   * limpo, sem truncar). Default: 200.
   */
  max?: number | null;
}

const DEFAULT_MAX = 200;

/**
 * Escolhe o primeiro candidato não-branco (`c != null && c.trim() !== ''`),
 * cai no `fallback` se nenhum servir, e normaliza o valor escolhido:
 * colapsa `\s+` em espaço, faz trim e — salvo `options.max === null` — corta
 * em `max` (default 200) com `…` no fim.
 */
export function normalizeOgDescription(
  candidates: Array<string | null | undefined>,
  fallback: string,
  options: NormalizeOgDescriptionOptions = {},
): string {
  const chosen =
    candidates.find((candidate) => candidate != null && candidate.trim() !== '') ?? fallback;
  const cleaned = chosen.replace(/\s+/g, ' ').trim();

  const max = options.max === undefined ? DEFAULT_MAX : options.max;
  if (max === null) return cleaned;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}
