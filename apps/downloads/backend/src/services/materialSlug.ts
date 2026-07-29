export const MAX_MATERIAL_SLUG_LENGTH = 160;

const MAX_UNIQUE_SLUG_ATTEMPTS = 50;

export class MaterialSlugExhaustedError extends Error {
  constructor() {
    super('Não foi possível gerar uma URL única para o material.');
    this.name = 'MaterialSlugExhaustedError';
  }
}

function trimLeadingHyphens(value: string): string {
  let start = 0;
  while (value[start] === '-') start += 1;
  return value.slice(start);
}

function trimTrailingHyphens(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '-') end -= 1;
  return value.slice(0, end);
}

function trimHyphens(value: string): string {
  const withoutLeading = trimLeadingHyphens(value);
  let end = withoutLeading.length;
  while (end > 0 && withoutLeading[end - 1] === '-') end -= 1;
  return withoutLeading.slice(0, end);
}

function collapseToSlugCharacters(value: string): string {
  let result = '';
  for (const character of value) {
    const isAsciiLetter = character >= 'a' && character <= 'z';
    const isDigit = character >= '0' && character <= '9';
    if (isAsciiLetter || isDigit) {
      result += character;
    } else if (result && !result.endsWith('-')) {
      result += '-';
    }
  }
  return trimHyphens(result);
}

export function slugifyMaterialTitle(title: string): string {
  // Achado real (review PR #228, Sonar): varredura linear substitui regexes
  // com quantificadores sobre entrada livre, preservando o slug produzido.
  const normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const slug = collapseToSlugCharacters(normalized);

  return trimHyphens((slug || 'material').slice(0, MAX_MATERIAL_SLUG_LENGTH)) || 'material';
}

export function appendMaterialSlugSuffix(base: string, suffix: string): string {
  const normalizedSuffix = trimLeadingHyphens(suffix);
  const reservedLength = normalizedSuffix.length + 1;
  const truncatedBase = trimTrailingHyphens(base.slice(0, MAX_MATERIAL_SLUG_LENGTH - reservedLength));
  return `${truncatedBase || 'material'}-${normalizedSuffix}`;
}

function isMaterialSlugUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === '23505' && candidate.constraint === 'idx_download_material_slug';
}

export async function createWithUniqueMaterialSlug<T>(
  title: string,
  create: (slug: string) => Promise<T>,
): Promise<T> {
  const base = slugifyMaterialTitle(title);

  for (let attempt = 1; attempt <= MAX_UNIQUE_SLUG_ATTEMPTS; attempt += 1) {
    const slug = attempt === 1 ? base : appendMaterialSlugSuffix(base, String(attempt));
    try {
      return await create(slug);
    } catch (error) {
      // O índice UNIQUE decide a corrida. Consulta prévia seguida de INSERT
      // permitiria duas requisições escolherem o mesmo slug simultaneamente.
      if (!isMaterialSlugUniqueViolation(error)) throw error;
    }
  }

  throw new MaterialSlugExhaustedError();
}
