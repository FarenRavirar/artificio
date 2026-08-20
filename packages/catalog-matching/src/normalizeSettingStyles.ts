// R19 (spec 093): normalizacao canonica de setting_styles na escrita.
//
// Forma canonica definida pela migration_152 do mesas: capitalizar cada palavra
// — nao so a primeira ("dark fantasy" -> "Dark Fantasy") —, preservar preposicao
// interna ("Fatia de vida" -> "Fatia de Vida", nunca "Fatia De Vida") e remover
// pontuacao terminal ("Exploracao." -> "Exploracao").
//
// Vive aqui, e nao em apps/mesas, porque backend e frontend gravam o campo e
// precisam da MESMA regra: divergir produz chip duplicado no catalogo, que e o
// defeito que R19/R20 existem para corrigir. A primeira versao (PR #278) foi
// escrita duas vezes, uma em cada app, com um comentario mandando "sincronizar
// as duas" — o Sonar flagrou 68,9%/76,9% de duplicacao e estava certo: instrucao
// em comentario nao e mecanismo (AGENTS.md §Compartilhado por padrao).

const LOWERCASE_INTERNAL_WORDS = new Set([
  'a', 'as', 'o', 'os', 'ao', 'aos', 'à', 'às',
  'de', 'da', 'do', 'das', 'dos', 'dum', 'duma', 'duns', 'dumas',
  'em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'nuns', 'numas',
  'com', 'por', 'para', 'per', 'sem', 'sob', 'sobre', 'entre',
  'até', 'após', 'desde', 'contra', 'ante', 'perante', 'trás',
  'e', 'ou', 'nem', 'mas',
  'pelo', 'pela', 'pelos', 'pelas',
  // Preposicoes/artigos em ingles — aparecem em estilos importados ("Slice of
  // Life", "Dungeons and Dragons"). Sem elas, "of"/"and" sairiam capitalizados
  // ("Slice Of Life"), divergindo da grafia consolidada do proprio estoque.
  'of', 'and', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from',
]);

function capitalizeWord(word: string): string {
  // ALL CAPS ("SOBREVIVENCIA") -> normaliza para capitalizada ("Sobrevivencia").
  // Distingue de camelCase ("MegaDungeon"), que preserva a maiuscula interna:
  // o initcap/`.toLowerCase()` global anterior achatava "MegaDungeon" para
  // "Megadungeon" (regressao medida no estoque em 2026-08-20, spec 093 R20).
  const isAllCaps = word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
  if (isAllCaps) {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizeStyleWord(raw: string): string {
  // Remove pontuacao/simbolo/whitespace no inicio e no fim ("Exploracao." -> "Exploracao").
  const trimmed = raw.trim().replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && LOWERCASE_INTERNAL_WORDS.has(lower)) return lower;
      return capitalizeWord(word);
    })
    .join(' ');
}

/**
 * Normaliza uma lista de estilos de cenario para a forma canonica.
 * Devolve `null` para entrada ausente/vazia — nunca `[]` —, porque o chamador
 * distingue "campo nao enviado" de "campo limpo" (ver gmPanel.ts).
 */
export function normalizeSettingStyles(styles: string[] | null | undefined): string[] | null {
  if (!Array.isArray(styles)) return null;
  const normalized = styles
    .map((s) => (typeof s === 'string' ? normalizeStyleWord(s) : ''))
    .filter((s) => s.length > 0);
  return normalized.length > 0 ? normalized : null;
}
