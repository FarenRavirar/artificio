import { db } from '../db/index.js';
import { enqueueNotification, isValidCanonicalPath, type MesasEventType } from './notificationOutbox.js';
import { deliverPendingNotifications } from './notificationOutboxDelivery.js';

// Tipos canonicos de notificacao para o feed do admin.
export type AdminNotificationType =
  | 'system_suggestion'
  | 'scenario_suggestion'
  | 'table_published'
  | 'member_joined'
  | 'dev_feedback';

/**
 * T7.4b (spec 096): tradução do vocabulário local para o do registro central.
 * Os nomes antigos continuam sendo a API desta função — os 4 chamadores
 * (`devFeedback.ts`, `discord/utils.ts`, `gmPanel.ts` ×2) não mudaram.
 */
const ADMIN_EVENT_TYPE: Record<AdminNotificationType, MesasEventType> = {
  system_suggestion: 'mesas.admin.system_suggestion',
  scenario_suggestion: 'mesas.admin.scenario_suggestion',
  table_published: 'mesas.admin.table_published',
  member_joined: 'mesas.admin.member_joined',
  dev_feedback: 'mesas.admin.dev_feedback',
};

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
 * Enfileira uma notificação para cada admin, exceto `excludeUserId`.
 *
 * T7.4b (spec 096): antes gravava direto em `notifications`, tabela própria do
 * mesas; agora enfileira no outbox e o `accounts.` é quem entrega. O
 * `NotificationBell` de `packages/ui` já lê por `source_app`, então a leitura
 * não muda para o usuário.
 *
 * **Não-fatal por decisão, e agora sem o custo que isso tinha.** O `catch` que
 * engole continua aqui — um aviso não deve derrubar a ação de mérito —, mas
 * antes ele significava *aviso perdido sem registro*: o INSERT falhava e não
 * sobrava nenhum rastro. Agora a falha possível é só a de enfileirar; entregue
 * ao outbox, o evento tem `attempt_count` e `last_error`, e o sweep retenta.
 *
 * O aviso "nao use dentro de transacao" caiu junto: `enqueueNotification` aceita
 * `trx` justamente para ser chamada lá dentro.
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

    await enqueueNotification({
      eventType: ADMIN_EVENT_TYPE[input.type],
      subjectType: 'admin_notice',
      subjectId: input.type,
      // Fallback para o painel do admin: `action_url` é opcional na API antiga,
      // e o outbox exige path válido.
      //
      // Achado real (review PR #289, inline): o `??` cobria só a AUSÊNCIA. Um
      // `action_url` inválido fazia `enqueueNotification` lançar dentro do
      // `try`, e o `catch` abaixo — que existe para o aviso não derrubar a ação
      // de mérito — engolia o erro: aviso perdido em silêncio. Medido nos 4
      // chamadores: `/gestao`, `/gestao/sistema` e dois `/mesas/${slug}`
      // interpolados, que degeneram para `/mesas/` se o slug vier vazio.
      canonicalPath: input.action_url && isValidCanonicalPath(input.action_url)
        ? input.action_url
        : '/gestao',
      snapshot: {
        legacy_type: input.type,
        title: input.title,
        message: input.message,
        ...(input.metadata ?? {}),
      },
      recipients: admins.map((admin) => admin.id),
    });

    // Entrega imediata; o sweep periódico cobre o que falhar aqui.
    void deliverPendingNotifications().catch((deliveryError: unknown) => {
      console.error('[notifyAdmins] Falha na entrega pós-commit do outbox:', deliveryError);
    });
  } catch (error) {
    console.error('[notifyAdmins]', input.type, error);
  }
}
