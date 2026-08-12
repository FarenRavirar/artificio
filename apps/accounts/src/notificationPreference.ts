import type { Kysely } from "kysely";
import type { Database } from "./db.js";

// ============================================================================
// T3.11b — Preferência de notificação (requisitos 20a-20c)
//
// Eixo: tipo de evento, nunca source_app. Um item por event_type técnico.
// Linha ausente = tudo ligado (default). Moderação NÃO é desligável (20b).
// Tabela: notification_preference (migration_010, seção 4), sem realm (20a-ii).
// ============================================================================

// ---- catálogo de tipos de evento ----

/**
 * Tipos de evento que NUNCA podem ser desligados (requisito 20b).
 * Moderação é devido processo — remoção silenciosa é shadow ban recusado.
 */
const MODERATION_EVENT_TYPES = new Set([
  "moderation.comment_removed",
  "moderation.comment_restored",
  "moderation.report_resolved",
  "moderation.appeal_resolved",
  "moderation.sanction_applied",
  "moderation.sanction_lifted",
]);

/**
 * Rótulos legíveis para cada event_type (requisito 20a-i).
 * Registrar tipo novo exige rótulo — a API recusa tipo desconhecido.
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  "comment.created": "Comentário no meu conteúdo",
  "comment.replied": "Resposta ao meu comentário",
  "moderation.comment_removed": "Comentário removido pela moderação",
  "moderation.comment_restored": "Comentário restaurado",
  "moderation.report_resolved": "Decisão sobre denúncia",
  "moderation.appeal_resolved": "Decisão sobre recurso",
  "moderation.sanction_applied": "Sanção aplicada à sua conta",
  "moderation.sanction_lifted": "Sanção removida",
};

// ---- helpers ----

export function isModerationEvent(eventType: string): boolean {
  return MODERATION_EVENT_TYPES.has(eventType) || eventType.startsWith("moderation.");
}

export function getEventTypeLabel(eventType: string): string | null {
  return EVENT_TYPE_LABELS[eventType] ?? null;
}

/**
 * Catálogo completo. Usado pela API de preferências para listar
 * todos os tipos conhecidos com seus rótulos.
 */
export function listEventTypes(): { event_type: string; label: string; modifiable: boolean }[] {
  return Object.entries(EVENT_TYPE_LABELS).map(([event_type, label]) => ({
    event_type,
    label,
    modifiable: !isModerationEvent(event_type),
  }));
}

// ---- preferência do usuário ----

/**
 * Devolve `true` se o evento deve ser entregue a este usuário.
 * - Moderação: sempre true (20b)
 * - Social: true a menos que o usuário tenha `enabled = false` (20a)
 * - Sem linha de preferência: true (default = tudo ligado)
 */
export async function shouldDeliver(
  db: Kysely<Database>,
  userId: string,
  eventType: string,
): Promise<boolean> {
  if (isModerationEvent(eventType)) return true;

  const pref = await db
    .selectFrom("notification_preference")
    .select("enabled")
    .where("user_id", "=", userId)
    .where("event_type", "=", eventType)
    .executeTakeFirst();

  // Sem linha = tudo ligado (default)
  return pref?.enabled !== false;
}

/**
 * Lista preferências do usuário. Tipos sem linha aparecem como enabled: true.
 */
export async function listPreferences(
  db: Kysely<Database>,
  userId: string,
): Promise<{ event_type: string; label: string; enabled: boolean; modifiable: boolean }[]> {
  const catalog = listEventTypes();
  const rows = await db
    .selectFrom("notification_preference")
    .select(["event_type", "enabled"])
    .where("user_id", "=", userId)
    .execute();

  const rowMap = new Map(rows.map((r) => [r.event_type, r.enabled]));

  return catalog.map((entry) => ({
    event_type: entry.event_type,
    label: entry.label,
    enabled: rowMap.has(entry.event_type) ? rowMap.get(entry.event_type)! : true,
    modifiable: entry.modifiable,
  }));
}

/**
 * Define preferência (liga/desliga). Moderação é recusada (20b).
 * Linha nova = INSERT, existente = UPDATE, enabled = true em tipo sem linha
 * prévia = DELETE (volta ao default "ligado").
 */
export async function setPreference(
  db: Kysely<Database>,
  userId: string,
  eventType: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; code: string }> {
  // Valida tipo conhecido
  if (!getEventTypeLabel(eventType)) {
    return { ok: false, code: "unknown_event_type" };
  }

  // Moderação não pode ser desligada
  if (isModerationEvent(eventType) && !enabled) {
    return { ok: false, code: "moderation_not_modifiable" };
  }

  const existing = await db
    .selectFrom("notification_preference")
    .select("id")
    .where("user_id", "=", userId)
    .where("event_type", "=", eventType)
    .executeTakeFirst();

  if (enabled && !existing) {
    // Default já é ligado — não precisa criar linha
    return { ok: true };
  }

  if (enabled && existing) {
    // Remover linha: volta ao default ligado
    await db
      .deleteFrom("notification_preference")
      .where("id", "=", existing.id)
      .execute();
    return { ok: true };
  }

  if (!enabled && !existing) {
    // Criar linha de desligamento
    await db
      .insertInto("notification_preference")
      .values({ user_id: userId, event_type: eventType, enabled: false })
      .execute();
    return { ok: true };
  }

  if (!enabled && existing) {
    await db
      .updateTable("notification_preference")
      .set({ enabled: false, updated_at: new Date() })
      .where("id", "=", existing.id)
      .execute();
    return { ok: true };
  }

  // Fallback: todas as combinações cobertas acima
  return { ok: true };
}
