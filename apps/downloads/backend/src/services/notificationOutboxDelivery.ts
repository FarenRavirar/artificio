import type { Kysely } from 'kysely';
import { fetch as undiciFetch } from 'undici';
import { createOutboxRunner, type DeliveryResult } from '@artificio/comments';
import { db } from '../db';
import type { Database } from '../db/types';

// ============================================================================
// T3.5/T3.13 (spec 090) — entrega do outbox local do `downloads`
//
// A lógica de entrega — claim atômico, lease, política de retry, backoff e
// timeout —, MAIS a leitura de env e o sweep periódico, vivem em
// `@artificio/comments` (`notificationOutboxDelivery.ts`), ao lado da resolução
// de destinatários. Aqui fica só o que é DESTE app: o nome da tabela, o
// transporte e o rótulo do log.
//
// Sonar acusou 80,8% de duplicação entre os gêmeos de `mesas` e `downloads`
// (PR #289) — 141 linhas contra 139. O custo da cópia já tinha sido pago: a
// PR #257 endureceu a política de retry de um lado só, e o outro nasceu depois
// herdando o texto antigo. A primeira extração levou a entrega e deixou os
// wrappers duplicados em 27,1%/20,0%; `createOutboxRunner` fechou essa metade.
// ============================================================================

const OUTBOX_TABLE = 'download_notification_outbox';

export type { DeliveryResult };

const runner = createOutboxRunner<Kysely<Database>>({
  table: OUTBOX_TABLE,
  // Mesmo transporte já usado por `accountsClient.ts` (undici explícito).
  //
  // `cancelBody` é obrigatório aqui: o undici mantém o corpo pendente e a
  // conexão presa até alguém consumi-lo ou cancelá-lo, e esta entrega só olha o
  // status (achado de review, PR #289, CodeRabbit). Sem isto, cada entrega
  // vazaria uma conexão do pool.
  fetchImpl: async (url, init) => {
    const response = await undiciFetch(url, init as Parameters<typeof undiciFetch>[1]);
    return {
      status: response.status,
      cancelBody: () => response.body?.cancel() ?? Promise.resolve(),
    };
  },
  logTag: '[notificationOutboxDelivery]',
  defaultDb: db,
});

export const { deliverPendingNotifications } = runner;

/** `NodeJS.Timeout` na fronteira: o pacote não depende de tipos de Node. */
export const startNotificationOutboxSweep = runner.startNotificationOutboxSweep as (
  database?: Kysely<Database>,
) => NodeJS.Timeout;
