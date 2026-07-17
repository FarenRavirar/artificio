import { db } from '../db/index.js';

// Tipos canonicos de notificacao para o feed do admin.
export type AdminNotificationType =
  | 'system_suggestion'
  | 'scenario_suggestion'
  | 'table_published'
  | 'member_joined'
  | 'dev_feedback';

export interface AdminNotificationInput {
  type: AdminNotificationType;
  title: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
  /** Nao notifica este usuario (ex.: o proprio admin que executou a acao). */
  excludeUserId?: string | null;
}

/**
 * Cria uma notificacao para cada admin, exceto `excludeUserId`.
 * Nao-fatal: erros sao logados e engolidos para nao quebrar a acao principal.
 * Nao use dentro de transacao: erro SQL em transacao aborta o contexto do chamador.
 */
export async function notifyAdmins(
  input: AdminNotificationInput,
): Promise<void> {
  try {
    let query = db.selectFrom('users').select('id').where('role', '=', 'admin');
    if (input.excludeUserId) {
      query = query.where('id', '!=', input.excludeUserId);
    }
    const admins = await query.execute();
    if (admins.length === 0) return;

    await db
      .insertInto('notifications')
      .values(
        admins.map((admin) => ({
          user_id: admin.id,
          type: input.type,
          title: input.title,
          message: input.message,
          action_url: input.action_url ?? null,
          metadata: JSON.stringify(input.metadata ?? {}),
        })),
      )
      .execute();
  } catch (error) {
    console.error('[notifyAdmins]', input.type, error);
  }
}
