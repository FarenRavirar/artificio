export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim();
  if (email.length < 3 || email.length > 254) {
    return false;
  }

  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) {
    return false;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!local || !domain || domain.length > 253) {
    return false;
  }

  const dotIndex = domain.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === domain.length - 1) {
    return false;
  }

  return !email.includes(' ') && !email.includes('\t') && !email.includes('\n');
}

/**
 * UUID em forma canônica (qualquer versão). Fonte única do backend do mesas —
 * `gmPanel.ts`, `devFeedbackAdmin.ts` e `tableService.ts` tinham cada um a sua
 * cópia da mesma regex.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
