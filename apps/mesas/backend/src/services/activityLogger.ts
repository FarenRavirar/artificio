import { Transaction } from 'kysely';
import { db } from '../db/index.js';
import { Database, UserRole } from '../db/types.js';

export type ActivityAction =
  | 'user.registered' | 'user.role_changed'
  | 'table.created' | 'table.updated' | 'table.deleted' | 'table.status_changed'
  | 'table.archived' | 'table.unarchived'
  | 'system.created' | 'system.updated' | 'system.deleted'
  | 'scenario.created' | 'scenario.updated' | 'scenario.deleted'
  | 'system_suggestion.created' | 'system_suggestion.approved' | 'system_suggestion.rejected'
  | 'system_suggestion.resolved'
  | 'scenario_suggestion.created' | 'scenario_suggestion.approved' | 'scenario_suggestion.rejected'
  | 'dev_feedback.created' | 'dev_feedback.updated'
  | 'dev_feedback.archived' | 'dev_feedback.deleted' | 'dev_feedback.merged'
  // Spec 106 R8: as quatro portas de nome/slug, sucesso e recusa. `activity_log.action`
  // e `text` sem CHECK (medido), entao nao exige migration.
  | 'profile.display_name_changed' | 'profile.display_name_rejected'
  | 'gm.nickname_changed' | 'gm.nickname_rejected'
  | 'user.username_changed' | 'user.username_rejected'
  | 'gm.slug_changed' | 'gm.slug_rejected'
  // Spec 106 R19: primeira ocorrencia de um erro de cliente; R13/R20: alertas do cron.
  | 'client_error.first_seen' | 'dev_feedback.stale_alerted' | 'contact.tail_detected';

export type ActivityEntityType =
  | 'user' | 'table' | 'system' | 'scenario'
  | 'system_suggestion' | 'scenario_suggestion'
  | 'dev_feedback' | 'gm_profile' | 'client_error' | 'table_contact';

export interface LogActivityInput {
  actorId: string | null;
  actorRole?: UserRole | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string | null;
  entityLabel?: string | null;
  targetUserId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(
  input: LogActivityInput,
  trx?: Transaction<Database>
): Promise<void> {
  try {
    const executor = trx ?? db;

    await executor
      .insertInto('activity_log')
      .values({
        actor_id: input.actorId,
        actor_role: input.actorRole ?? null,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        entity_label: input.entityLabel ?? null,
        target_user_id: input.targetUserId ?? null,
        summary: input.summary,
        metadata: JSON.stringify(input.metadata ?? {}),
      })
      .executeTakeFirst();
  } catch (err) {
    console.error('[activityLogger]', err);
  }
}
