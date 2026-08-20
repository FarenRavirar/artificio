// R19 (spec 093): normalização canônica de setting_styles na escrita.
//
// ESPELHO de apps/mesas/backend/src/discord/normalizeSettingStyles.ts — a regra é
// idêntica e deve permanecer sincronizada. Backend e frontend são raízes de build
// separadas (não há pacote compartilhado de domínio mesas; migração para
// `@artificio/*` é decisão do mantenedor, ver spec 086). Não alterar uma sem
// sincronizar a outra (AGENTS.md §Compartilhado por padrão).

const LOWERCASE_INTERNAL_WORDS = new Set([
  'a', 'as', 'o', 'os', 'ao', 'aos', 'à', 'às',
  'de', 'da', 'do', 'das', 'dos', 'dum', 'duma', 'duns', 'dumas',
  'em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'nuns', 'numas',
  'com', 'por', 'para', 'per', 'sem', 'sob', 'sobre', 'entre',
  'até', 'após', 'desde', 'contra', 'ante', 'perante', 'trás',
  'e', 'ou', 'nem', 'mas',
  'pelo', 'pela', 'pelos', 'pelas',
]);

function normalizeStyleWord(raw: string): string {
  const trimmed = raw.trim().replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && LOWERCASE_INTERNAL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function normalizeSettingStyles(styles: string[] | null | undefined): string[] | null {
  if (!Array.isArray(styles)) return null;
  const normalized = styles
    .map((s) => (typeof s === 'string' ? normalizeStyleWord(s) : ''))
    .filter((s) => s.length > 0);
  return normalized.length > 0 ? normalized : null;
}
