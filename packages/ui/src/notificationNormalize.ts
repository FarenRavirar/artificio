// ============================================================================
// Normalizador compartilhado de payload de notificação (achado CodeRabbit,
// PR #255). fetch/res.json() devolve `unknown` — sem isso, item malformado
// (campo ausente, `items` não-array) quebra render em NotificationBell
// (packages/ui) e NotificationsView (apps/accounts/frontend).
// ============================================================================

export interface NormalizedNotificationItem {
  id: string;
  event_type: string;
  text: string;
  link: string | null;
  source_label: string;
  occurred_at: string;
  read_at: string | null;
}

export interface NormalizedNotificationsPage {
  items: NormalizedNotificationItem[];
  cursor: string | null;
}

function isNotificationItem(value: unknown): value is NormalizedNotificationItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.event_type === "string" &&
    typeof v.text === "string" &&
    (typeof v.link === "string" || v.link === null) &&
    typeof v.source_label === "string" &&
    typeof v.occurred_at === "string" &&
    (typeof v.read_at === "string" || v.read_at === null)
  );
}

/** Devolve `null` quando o payload não tem a forma esperada — caller decide o fallback. */
export function normalizeNotificationsPage(
  value: unknown,
): NormalizedNotificationsPage | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.items)) return null;
  const items = v.items.filter(isNotificationItem);
  const cursor = typeof v.cursor === "string" ? v.cursor : null;
  return { items, cursor };
}

export function normalizeUnreadCount(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const count = v.count;
  // Contagem é sempre inteiro >= 0 — negativo, fracionário, NaN/Infinity
  // ou fora de Number.isSafeInteger indicam payload corrompido, não um
  // valor de badge legítimo (achado CodeRabbit, PR #255).
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    return null;
  }
  return count;
}
