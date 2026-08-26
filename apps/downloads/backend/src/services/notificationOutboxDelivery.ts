import type { Kysely } from 'kysely';
import { fetch as undiciFetch } from 'undici';
import {
  createKyselyOutboxStore,
  deliverOutboxEntries,
  OUTBOX_SWEEP_INTERVAL_MS,
  type DeliveryResult,
} from '@artificio/comments';
import { db } from '../db';
import type { Database } from '../db/types';

// ============================================================================
// T3.5/T3.13 (spec 090) — entrega do outbox local do `downloads`
//
// A lógica de entrega — claim atômico, lease, política de retry e timeout —
// vive em `@artificio/comments` (`notificationOutboxDelivery.ts`), ao lado da
// resolução de destinatários. Aqui fica só o que é DESTE app: o NOME da tabela,
// o transporte e a leitura das envs.
//
// Sonar acusou 80,8% de duplicação entre os gêmeos de `mesas` e `downloads`
// (PR #289) — 141 linhas contra 139, divergindo só nesses três pontos. O custo
// da cópia já tinha sido pago: a PR #257 endureceu a política de retry de um
// lado só, e o outro nasceu depois herdando o texto antigo.
// ============================================================================

const OUTBOX_TABLE = 'download_notification_outbox';

export type { DeliveryResult };

export async function deliverPendingNotifications(
  database: Kysely<Database> = db,
): Promise<DeliveryResult> {
  const baseUrl = process.env.ACCOUNTS_URL?.trim().replace(/\/$/, '');
  const serviceCredential = process.env.SERVICE_CREDENTIAL?.trim() || undefined;

  if (!baseUrl || !serviceCredential) {
    // Avisa e não lança: a entrada fica pendente e sai na próxima varredura
    // quando a configuração existir — nada se perde por falta de env.
    console.warn('[notificationOutboxDelivery] ACCOUNTS_URL ou SERVICE_CREDENTIAL não configurado — entrega adiada.');
    return { delivered: 0, failed: 0, skipped: 0 };
  }

  return deliverOutboxEntries({
    store: createKyselyOutboxStore({ table: OUTBOX_TABLE, db: database as never }),
    // Mesmo transporte já usado por `accountsClient.ts` (undici explícito).
    fetchImpl: (url, init) => undiciFetch(url, init as Parameters<typeof undiciFetch>[1]),
    baseUrl,
    credential: serviceCredential,
    logTag: '[notificationOutboxDelivery]',
  });
}

export function startNotificationOutboxSweep(
  database: Kysely<Database> = db,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    void deliverPendingNotifications(database).catch((error: unknown) => {
      console.error('[notificationOutboxDelivery] falha na varredura periódica:', error);
    });
  }, OUTBOX_SWEEP_INTERVAL_MS);

  // `unref` para o timer não segurar o processo no encerramento — sem isso, o
  // container demoraria até 5 min para sair em cada deploy.
  timer.unref();
  return timer;
}
