import type { Kysely } from 'kysely';
import { createOutboxRunner } from '@artificio/comments';
import { db } from '../db/index.js';
import type { Database } from '../db/types.js';

// ============================================================================
// T7.4b (spec 096) — entrega do outbox local do `mesas`
//
// A lógica de entrega — claim atômico, lease, política de retry, backoff e
// timeout —, MAIS a leitura de env e o sweep periódico, vivem em
// `@artificio/comments` (`notificationOutboxDelivery.ts`). Aqui fica só o que é
// DESTE app: o nome da tabela, o transporte e o rótulo do log.
//
// Sonar acusou 80,8% de duplicação entre os gêmeos de `mesas` e `downloads`
// (PR #289); a primeira extração levou a entrega e deixou os wrappers, que
// continuaram duplicados em 27,1%/20,0% — a env, a guarda, o `setInterval` e o
// `unref()` eram os mesmos. `createOutboxRunner` fechou essa metade.
// ============================================================================

const OUTBOX_TABLE = 'mesas_notification_outbox';

export type { DeliveryResult } from '@artificio/comments';

const runner = createOutboxRunner<Kysely<Database>>({
  table: OUTBOX_TABLE,
  // `fetch` global, e não `undici`: este app não traz `undici` como dependência
  // direta. Resolvido NA CHAMADA, nunca capturado como `fetchImpl: fetch` — a
  // referência congelaria no valor que existia quando o módulo carregou, e os
  // testes que trocam o global deixariam de valer (mesma armadilha documentada
  // em `community/accountsProxy.ts:67-76`).
  fetchImpl: (url, init) => fetch(url, init as RequestInit),
  logTag: '[notificationOutboxDelivery]',
  defaultDb: db,
});

export const { deliverPendingNotifications } = runner;

/** `NodeJS.Timeout` na fronteira: o pacote não depende de tipos de Node. */
export const startNotificationOutboxSweep = runner.startNotificationOutboxSweep as (
  database?: Kysely<Database>,
) => NodeJS.Timeout;
