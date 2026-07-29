export const MAX_MATERIAL_SLUG_LENGTH = 160;

const MAX_UNIQUE_SLUG_ATTEMPTS = 50;

export class MaterialSlugExhaustedError extends Error {
  constructor() {
    super('Não foi possível gerar uma URL única para o material.');
    this.name = 'MaterialSlugExhaustedError';
  }
}

export function slugifyMaterialTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return (slug || 'material').slice(0, MAX_MATERIAL_SLUG_LENGTH).replace(/-+$/g, '') || 'material';
}

export function appendMaterialSlugSuffix(base: string, suffix: string): string {
  const normalizedSuffix = suffix.replace(/^-+/, '');
  const reservedLength = normalizedSuffix.length + 1;
  const truncatedBase = base
    .slice(0, MAX_MATERIAL_SLUG_LENGTH - reservedLength)
    .replace(/-+$/g, '');
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
