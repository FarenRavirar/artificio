// Achado Sonar (PR #145): slugify/normalizeWebsiteUrl/isUniqueViolation/
// getErrorMessage duplicados identicamente entre communicationPlatforms.ts
// e vttPlatforms.ts. Extraido para util compartilhado.

const COMBINING_DIACRITICS_REGEX = /[\u0300-\u036f]/g;

export const slugifyPlatformName = (value: string): string => (
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_REGEX, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
);

export const normalizePlatformWebsiteUrl = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('URL da plataforma inválida.');
    }
    return url.toString();
  } catch {
    throw new Error('URL da plataforma inválida.');
  }
};

export const isPlatformUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }
  return (error as { code?: string }).code === '23505';
};

export const getPlatformErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Erro interno';
};
