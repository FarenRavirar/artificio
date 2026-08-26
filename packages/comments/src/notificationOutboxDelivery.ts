/**
 * Entrega do outbox local de notificação ao par consolidado do `accounts.`
 * (`POST /internal/v1/notifications/events`).
 *
 * ## Por que aqui, e não copiado em cada app
 *
 * `downloads` (spec 090) e `mesas` (T7.4b, spec 096) fazem exatamente a mesma
 * coisa: a linha entra no outbox junto da transação da ação de mérito, e a
 * entrega roda fora dela. Medido em 2026-08-26, antes desta extração: 139 linhas
 * de código no downloads contra 141 no mesas, e a divergência real era o **nome
 * da tabela** (6 ocorrências), o transporte (`undici` × `fetch` global) e três
 * melhorias que só o mesas tinha. Claim, lease, política de retry e timeout eram
 * idênticos — Sonar acusou 80,8%.
 *
 * O custo de manter as duas cópias já foi pago uma vez: a PR #257 endureceu a
 * política de retry **só no downloads**, e o mesas nasceu depois herdando o
 * texto por cópia. A próxima correção teria o mesmo destino.
 *
 * Este pacote já é dependência dos dois backends e já hospeda a outra metade da
 * regra de notificação (`notificationRecipients.ts`), pela mesma razão: regra
 * compartilhada que precisa de teste sem banco.
 *
 * ## O que NÃO entra aqui
 *
 * Kysely. O pacote não o declara como dependência e não vai passar a declarar
 * por causa disto — o acesso ao banco entra por uma porta (`OutboxStore`) que
 * cada app implementa com o próprio `db`. Mesma escolha de `facadeRelay.ts`, que
 * recebe `fetchImpl` em vez de importar um cliente HTTP.
 */

/** Uma linha do outbox, no formato que a entrega precisa ler. */
export interface OutboxEntry {
  id: string;
  event_id: string;
  event_type: string;
  event_version: number;
  subject_type: string;
  subject_id: string;
  canonical_path: string;
  snapshot: unknown;
  recipients: unknown;
  created_at: Date;
  attempt_count: number;
}

/** Campos que a entrega grava de volta na linha. */
export interface OutboxUpdate {
  delivered_at?: Date;
  last_error?: string | null;
  attempt_count?: number;
  claimed_until?: Date | null;
}

/**
 * Porta de persistência. O app implementa com o próprio Kysely — é o que mantém
 * este pacote livre de dependência de banco.
 */
export interface OutboxStore {
  /**
   * Reserva até `limit` entradas entregáveis e as devolve, em UM comando
   * atômico.
   *
   * Por que claim, e não `SELECT` simples: o disparo pós-commit e o sweep
   * periódico rodam concorrentes por construção, então os dois leriam as MESMAS
   * linhas e entregariam cada aviso duas vezes. A idempotência por `event_id` no
   * `accounts.` impede o aviso duplicado, mas não impede o trabalho duplicado
   * nem o 429 que ele provoca.
   *
   * Por que não `FOR UPDATE SKIP LOCKED`: ele segura o lock pela transação
   * inteira, e a entrega faz chamada de rede no meio — a transação ficaria
   * aberta durante o timeout de 5s por entrada.
   */
  claimPending(limit: number, maxAttempts: number, claimedUntil: Date): Promise<OutboxEntry[]>;
  update(id: string, values: OutboxUpdate): Promise<void>;
}

/**
 * Fábrica do `OutboxStore` sobre Kysely.
 *
 * O claim é o mesmo nos dois apps — só o nome da tabela muda —, então deixá-lo
 * no app manteria 65 das ~73 linhas idênticas, que é o que o Sonar continuava
 * acusando depois da primeira extração (medido: 89%).
 *
 * `db` chega tipado como `unknown`-ish de propósito: este pacote NÃO declara
 * kysely (a fronteira o mantém sem dependência de banco), e o consumidor já tem
 * o tipo do lado dele. O `as never` local é o preço de não arrastar kysely para
 * cá — e ele fica confinado a esta função, não espalhado pelos apps.
 */
export interface OutboxTableRef {
  /** Nome da tabela de outbox do app (`mesas_notification_outbox`, etc.). */
  table: string;
  /** O `db` (ou `trx`) do Kysely do app. */
  db: OutboxQueryable;
}

/** Fatia mínima do Kysely que o claim usa. Evita depender do pacote inteiro. */
export interface OutboxQueryable {
  updateTable: (table: string) => {
    set: (values: Record<string, unknown>) => {
      where: (...args: unknown[]) => unknown;
    };
  };
}

/**
 * Claim atômico + update, na tabela que o app indicar.
 *
 * `UPDATE ... RETURNING` com sub-select: um único comando marca e devolve as
 * linhas, e um segundo worker não enxerga o que o primeiro reservou — sem manter
 * transação aberta durante a chamada de rede.
 */
export function createKyselyOutboxStore(ref: OutboxTableRef): OutboxStore {
  const { table, db } = ref;
  // O builder é dinâmico por natureza aqui (o nome da tabela é parâmetro), então
  // o tipo estrito do Kysely não se aplica — os apps o recuperam na fronteira.
  const query = db as unknown as {
    updateTable: (t: string) => Record<string, (...args: unknown[]) => unknown>;
  };

  return {
    async claimPending(limit, maxAttempts, claimedUntil): Promise<OutboxEntry[]> {
      const now = new Date();
      const builder = query.updateTable(table) as never as KyselyUpdateBuilder;
      return builder
        .set({ claimed_until: claimedUntil })
        .where('id', 'in', (eb: KyselyExpressionBuilder) =>
          eb
            .selectFrom(table)
            .select('id')
            .where('delivered_at', 'is', null)
            .where('attempt_count', '<', maxAttempts)
            .where((inner: KyselyExpressionBuilder) =>
              inner.or([
                inner.eb('claimed_until', 'is', null),
                inner.eb('claimed_until', '<', now),
              ]),
            )
            .orderBy('created_at', 'asc')
            .limit(limit),
        )
        .returningAll()
        .execute() as Promise<OutboxEntry[]>;
    },
    async update(id, values): Promise<void> {
      const builder = query.updateTable(table) as never as KyselyUpdateBuilder;
      await builder.set({ ...values }).where('id', '=', id).execute();
    },
  };
}

/** Formas do builder do Kysely que o claim usa, sem importar o pacote. */
interface KyselyUpdateBuilder {
  set: (values: Record<string, unknown>) => KyselyUpdateBuilder;
  where: (...args: unknown[]) => KyselyUpdateBuilder;
  returningAll: () => KyselyUpdateBuilder;
  execute: () => Promise<unknown>;
}

interface KyselyExpressionBuilder {
  selectFrom: (table: string) => KyselyExpressionBuilder;
  select: (column: string) => KyselyExpressionBuilder;
  where: (...args: unknown[]) => KyselyExpressionBuilder;
  or: (list: unknown[]) => unknown;
  eb: (...args: unknown[]) => unknown;
  orderBy: (column: string, dir: string) => KyselyExpressionBuilder;
  limit: (n: number) => KyselyExpressionBuilder;
}

export type OutboxFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number }>;

export interface DeliveryOptions {
  store: OutboxStore;
  /** `fetch` global ou `undici` — cada app usa o que já traz. */
  fetchImpl: OutboxFetch;
  /** Origem do `accounts.`, sem barra final. */
  baseUrl: string;
  /** Credencial de serviço registrada (`X-Service-Token`). */
  credential: string;
  /** Prefixo dos logs, para o operador saber de qual app veio. */
  logTag: string;
}

export interface DeliveryResult {
  delivered: number;
  failed: number;
  skipped: number;
}

const REQUEST_TIMEOUT_MS = 5000;

/** Teto por varredura. Lote grande não vira uma rajada só. */
export const OUTBOX_BATCH_SIZE = 50;

/**
 * Depois disso a entrada para de ser tentada e fica registrada com o último
 * erro. Sem teto, um evento com payload permanentemente inválido (400) seria
 * retentado para sempre e empurraria a fila inteira.
 *
 * Exportado porque o índice parcial da migration espelha este número
 * (`WHERE delivered_at IS NULL AND attempt_count < 5`): mudar um exige mudar o
 * outro, e o valor precisa ser legível dos dois lados.
 */
export const OUTBOX_MAX_ATTEMPTS = 5;

/**
 * Validade do claim. Precisa cobrir o pior caso de uma varredura inteira
 * (`OUTBOX_BATCH_SIZE` × `REQUEST_TIMEOUT_MS` = 250s) com folga, senão o lease
 * expira enquanto o worker ainda está entregando e um segundo worker pega as
 * mesmas linhas. Curto o bastante para que worker morto não prenda a fila por
 * muito tempo.
 */
export const OUTBOX_CLAIM_LEASE_MS = 10 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O nome promete UUID e a checagem cumpre (achado de review, PR #289): id
 * não-UUID passava e levava 400 do ingest — que a política abaixo trata como
 * PERMANENTE, queimando o aviso de vez.
 */
function isUuidArray(value: unknown): value is string[] {
  return (
    Array.isArray(value)
    && value.every((item) => typeof item === 'string' && UUID_RE.test(item))
  );
}

/**
 * Normaliza JSONB vindo do banco. `unknown` até passar por checagem tipada
 * (AGENTS.md §Regras Gerais de Código): `snapshot` malformado quebraria o corpo
 * do POST com erro fora de qualquer try.
 */
function normalizeSnapshot(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function deliverOutboxEntries(options: DeliveryOptions): Promise<DeliveryResult> {
  const { store, fetchImpl, baseUrl, credential, logTag } = options;

  const claimedUntil = new Date(Date.now() + OUTBOX_CLAIM_LEASE_MS);
  const pending = await store.claimPending(OUTBOX_BATCH_SIZE, OUTBOX_MAX_ATTEMPTS, claimedUntil);

  const result: DeliveryResult = { delivered: 0, failed: 0, skipped: 0 };

  for (const entry of pending) {
    const recipients = entry.recipients;
    if (!isUuidArray(recipients) || recipients.length === 0) {
      // Payload que o `accounts.` recusaria com 400 em toda tentativa. Marca
      // entregue com erro registrado em vez de retentar cinco vezes o que não
      // tem como dar certo — e o `last_error` deixa o caso auditável.
      await store.update(entry.id, {
        delivered_at: new Date(),
        last_error: 'recipients inválido',
        claimed_until: null,
      });
      result.skipped++;
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetchImpl(`${baseUrl}/internal/v1/notifications/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': credential,
        },
        body: JSON.stringify({
          event_id: entry.event_id,
          event_type: entry.event_type,
          event_version: entry.event_version,
          subject_type: entry.subject_type,
          subject_id: entry.subject_id,
          canonical_path: entry.canonical_path,
          snapshot: normalizeSnapshot(entry.snapshot),
          recipients,
          // Momento real do fato no módulo de origem, não o da entrega: sem
          // isto, um sweep atrasado ordenaria os avisos pela hora em que a fila
          // esvaziou, não pela hora em que o fato aconteceu.
          occurred_at: entry.created_at.toISOString(),
        }),
        signal: controller.signal,
      });

      if (response.status === 202 || response.status === 200) {
        await store.update(entry.id, {
          delivered_at: new Date(),
          last_error: null,
          claimed_until: null,
        });
        result.delivered++;
        continue;
      }

      // Só esgota o teto o que é comprovadamente defeito do payload — 400 e
      // 422. Todo o resto do 4xx descreve o *ambiente*, não a mensagem, e o
      // ambiente muda sozinho:
      //
      // - `401`/`403`: credencial em rotação, ainda não emitida, ou sem
      //   `notification.write`. Corrigida a configuração, a mesma entrega passa.
      // - `404`: durante deploy escalonado o `accounts.` antigo ainda não tem a
      //   rota de ingestão. O deploy termina e a rota aparece.
      // - `429`: a rota passa por `communityRateLimit`, e um lote de até 50
      //   entregas estoura o bucket da credencial com facilidade.
      // - `408`: timeout declarado pelo servidor é transitório por definição.
      //
      // Tratar qualquer um deles como terminal gravaria `attempt_count = 5` e o
      // aviso nunca mais voltaria ao sweep — perda silenciosa causada por uma
      // janela de operação que já passou (achado de review, PR #257).
      const permanent = response.status === 400 || response.status === 422;

      // Falha de configuração se parece com falha transitória e consome as 5
      // tentativas em silêncio. Log explícito para o operador ver a causa antes
      // de a entrada esgotar o teto.
      if (response.status === 401 || response.status === 403) {
        console.error(
          `${logTag} HTTP ${response.status} — credencial de serviço ausente, revogada ou sem escopo notification.write. Tentativa ${entry.attempt_count + 1}/${OUTBOX_MAX_ATTEMPTS}.`,
        );
      }
      await store.update(entry.id, {
        attempt_count: permanent ? OUTBOX_MAX_ATTEMPTS : entry.attempt_count + 1,
        last_error: `HTTP ${response.status}`,
        // Libera o claim: a entrada volta à fila na próxima varredura em vez de
        // esperar o lease inteiro expirar.
        claimed_until: null,
      });
      result.failed++;
    } catch (error: unknown) {
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : String(error);
      await store.update(entry.id, {
        attempt_count: entry.attempt_count + 1,
        last_error: reason,
        claimed_until: null,
      });
      result.failed++;
    } finally {
      clearTimeout(timeout);
    }
  }

  return result;
}

/** Intervalo do sweep, igual nos dois apps e no `accounts.`. */
export const OUTBOX_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
