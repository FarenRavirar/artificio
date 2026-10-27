import type { Transaction } from 'kysely';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import type { Database, DevFeedbackStatus } from '../db/types.js';
import { notifyAdmins } from './adminNotifications.js';
import { enqueueNotification, isValidCanonicalPath } from './notificationOutbox.js';

/**
 * Spec 106 R13 / plan §11: o autor de um relato sabe quando ele foi analisado
 * (o `redfallen` ficou 13 dias sem resposta), e o admin sabe quando a fila para.
 */

/** Estados que encerram a análise e, por isso, avisam o autor. */
const AUTHOR_NOTICE_TEXT: Partial<Record<DevFeedbackStatus, string>> = {
  resolved: 'foi resolvido',
  wont_fix: 'foi analisado e não será tratado',
  duplicate: 'foi analisado e já está em outro relato',
};

export const STALE_AFTER_DAYS = 7;
/** `shortcut:` teto por execução do cron; a fila toda parada não vira rajada de avisos. Subir se a fila real pedir. */
const STALE_BATCH = 20;

const TITLE_MAX = 80;

export const isAuthorNoticeStatus = (status: DevFeedbackStatus): boolean => status in AUTHOR_NOTICE_TEXT;

interface FeedbackForNotice {
  id: string;
  user_id: string | null;
  title: string;
  route_path: string | null;
}

/**
 * Enfileira o aviso ao autor na transação do chamador. O texto é fixo e separado
 * de `admin_notes` (nota interna que nenhuma rota de usuário lê). O título é
 * texto do próprio autor, truncado. Sem `user_id` (relato anônimo): nada a enviar.
 * A entrega imediata fica com o chamador, depois do commit.
 */
export async function enqueueAuthorNotice(
  trx: Transaction<Database>,
  row: FeedbackForNotice,
  status: DevFeedbackStatus,
): Promise<void> {
  const text = AUTHOR_NOTICE_TEXT[status];
  if (!row.user_id || !text) return;

  const title = row.title.length > TITLE_MAX ? `${row.title.slice(0, TITLE_MAX)}…` : row.title;
  const message = `Seu relato "${title}" ${text}.`;
  await enqueueNotification(
    {
      eventType: 'mesas.system.notice',
      subjectType: 'dev_feedback',
      subjectId: row.id,
      canonicalPath: row.route_path && isValidCanonicalPath(row.route_path) ? row.route_path : '/',
      body: message,
      snapshot: { legacy_type: 'system', title: 'Seu relato foi analisado', message, feedback_id: row.id, status },
      recipients: [row.user_id],
    },
    trx,
  );
}

/**
 * Alerta de fila parada (cron): relato `new`, sem revisão, com `STALE_AFTER_DAYS`
 * dias. Um aviso por relato: o UPDATE ... RETURNING marca `stale_alerted_at` e
 * devolve só as linhas que ESTE processo marcou, então duas execuções
 * simultâneas não avisam duas vezes. Marcar antes de avisar troca "aviso
 * duplicado" por "aviso perdido se a fila de saída falhar"; `notifyAdmins` já é
 * não-fatal por decisão, e o relato continua visível na triagem.
 */
export async function alertStaleFeedback(): Promise<number> {
  const claimed = await db
    .updateTable('dev_feedback')
    .set({ stale_alerted_at: new Date() })
    .where('id', 'in', (eb) =>
      eb
        .selectFrom('dev_feedback')
        .select('id')
        .where('status', '=', 'new')
        .where('reviewed_at', 'is', null)
        .where('archived_at', 'is', null)
        .where('stale_alerted_at', 'is', null)
        .where('created_at', '<', sql<Date>`now() - (${STALE_AFTER_DAYS} * interval '1 day')`)
        .orderBy('created_at')
        .limit(STALE_BATCH),
    )
    .where('stale_alerted_at', 'is', null)
    .returning(['id', 'title', 'kind'])
    .execute();

  // Em paralelo: a entrega do outbox faz claim atômico com lease, então entregas simultâneas não duplicam.
  await Promise.all(
    claimed.map((row) =>
      notifyAdmins({
        type: 'feedback_stale',
        awaitDelivery: true,
        title: 'Relato parado na fila',
        message: `"${row.title.slice(0, TITLE_MAX)}" está há ${STALE_AFTER_DAYS} dias sem triagem.`,
        // `/gestao` redireciona para a visão geral; a fila só aparece nesta aba (mesmo destino de devFeedback.ts).
        action_url: '/gestao/sistema?tab=feedback',
        metadata: { feedback_id: row.id, kind: row.kind },
      }),
    ),
  );
  return claimed.length;
}
