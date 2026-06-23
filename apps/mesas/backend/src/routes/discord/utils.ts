import { db } from '../../db';
import type { SystemEntry } from '../../discord';
import { normalizeDiscordTableDraft } from '../../discord';
import { notifyAdmins } from '../../services/adminNotifications';

// Embeds/attachments podem vir como array (novo) ou JSON string (dados antigos)
export function parseJsonField(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.data)) return record.data;
    return Object.values(record);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed) {
        const record = parsed as Record<string, unknown>;
        if (Array.isArray(record.items)) return record.items;
        if (Array.isArray(record.data)) return record.data;
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function loadSystemsForParser(): Promise<SystemEntry[]> {
  const systems = await db
    .selectFrom('systems')
    .select(['id', 'name', 'name_pt'])
    .execute();

  const aliases = await db
    .selectFrom('system_aliases')
    .select(['system_id', 'alias'])
    .execute();

  const aliasMap = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.system_id) ?? [];
    list.push(a.alias);
    aliasMap.set(a.system_id, list);
  }

  return systems.map((s) => ({
    id: s.id,
    name: s.name,
    name_pt: s.name_pt,
    aliases: aliasMap.get(s.id) ?? [],
  }));
}

function getUnmatchedSystemHint(draft: ReturnType<typeof normalizeDiscordTableDraft>['draft']): string | null {
  if (draft.table.system_id) return null;
  const hint = draft.table.raw_system_hint ?? draft.table.system_name;
  const normalized = typeof hint === 'string' ? hint.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

export async function ensureSystemSuggestionForDraft(
  draft: ReturnType<typeof normalizeDiscordTableDraft>['draft'],
  adminId: string | undefined,
  sourceLabel: string | null | undefined,
): Promise<void> {
  try {
    const rawHint = getUnmatchedSystemHint(draft);
    if (!rawHint || !adminId) return;

    const existing = await db
      .selectFrom('system_suggestions')
      .select('id')
      .where('name', '=', rawHint)
      .where('status', 'in', ['pending', 'approved'])
      .executeTakeFirst();

    if (existing) return;

    const createdSuggestion = await db
      .insertInto('system_suggestions')
      .values({
        user_id: adminId,
        name: rawHint,
        name_pt: null,
        node_type: 'system',
        parent_id: null,
        description: `Sugestão automática gerada ao parsear mensagem Discord: "${sourceLabel ?? rawHint}"`,
        aliases: [rawHint],
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      })
      .returning(['id', 'name'])
      .executeTakeFirst();

    if (createdSuggestion) {
      await notifyAdmins({
        type: 'system_suggestion',
        title: 'Nova sugestão de sistema (Discord)',
        message: `Sugestão automática "${createdSuggestion.name}" detectada no Discord.`,
        action_url: '/gestao',
        metadata: {
          suggestion_id: createdSuggestion.id,
          suggestion_kind: 'system',
          source: 'discord',
        },
      });
    }
  } catch (error) {
    console.error('[ensureSystemSuggestionForDraft]', error);
  }
}
