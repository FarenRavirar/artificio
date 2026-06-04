import DOMPurify from 'dompurify';

/**
 * Sanitização production-grade usando DOMPurify
 * Protege contra XSS, SVG injection, atributos perigosos, etc.
 */
export function sanitize(input: string): string {
  // Remove TODAS as tags HTML e atributos perigosos
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Nenhuma tag HTML permitida
    ALLOWED_ATTR: [], // Nenhum atributo permitido
    KEEP_CONTENT: true, // Mantém o texto interno
  }).trim();
}

/**
 * Sanitiza objeto recursivamente
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitize(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? sanitize(item) : item));
  }

  return value;
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, sanitizeValue(value)])
  ) as T;
}
