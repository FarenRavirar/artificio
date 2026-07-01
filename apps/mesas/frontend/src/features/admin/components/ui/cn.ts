/** Junta classes condicionais sem dependência externa (clsx-lite). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
