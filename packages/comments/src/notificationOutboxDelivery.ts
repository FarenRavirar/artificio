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
  transient_count: number;
  /**
   * Somente migração de histórico legado: preenchido, pede ao ingest que o
   * recibo nasça já lido. `null`/ausente no fluxo normal — aviso novo é
   * pendente por definição.
   */
  read_at?: Date | null;
}

/** Campos que a entrega grava de volta na linha. */
export interface OutboxUpdate {
  delivered_at?: Date;
  last_error?: string | null;
  attempt_count?: number;
  transient_count?: number;
  claimed_until?: Date | null;
  next_attempt_at?: Date | null;
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
 * Espera antes da próxima tentativa, por número de tentativas já feitas.
 *
 * Backoff exponencial com teto: 1min, 2, 4, 8, 16, 32, 60, 60… A entrada NÃO é
 * abandonada por falha transitória — ela só volta mais devagar, para que uma
 * indisponibilidade longa do `accounts.` não vire uma rajada de retentativas a
 * cada 5 minutos por entrada da fila inteira.
 *
 * Recebe `transient_count`, NÃO `attempt_count` — são contadores distintos de
 * propósito (ver `transientUpdate`). Achado de review (PR #289, Codex P1): antes
 * `attempt_count` era incrementado igual em 5xx/429/rede, e `claimPending`
 * filtra `attempt_count < 5`, então uma queda de ~25min do `accounts.` (cinco
 * sweeps) abandonava permanentemente avisos válidos. A primeira correção
 * acrescentou este backoff mas manteve o incremento, o que apenas ADIOU o
 * abandono para a quinta falha; a segunda separou os contadores.
 */
export function backoffDelayMs(attemptCount: number): number {
  const minutes = Math.min(2 ** attemptCount, OUTBOX_BACKOFF_CAP_MINUTES);
  return minutes * 60 * 1000;
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
 * linhas, sem manter transação aberta durante a chamada de rede.
 *
 * ## Por que a condição de lease se repete no UPDATE externo
 *
 * Achado de review (PR #289, Codex P2). Com a condição SÓ na sub-consulta, dois
 * claims concorrentes (o sweep periódico e o disparo pós-commit, que rodam
 * juntos por construção) podem avaliar a sub-consulta antes de qualquer lease
 * ser gravado e escolher os mesmos ids. O segundo `UPDATE` bloqueia no lock de
 * linha do primeiro, e quando ele libera, o segundo reavalia apenas
 * `id IN (...)` — que continua verdadeiro — e devolve as MESMAS linhas de novo.
 * Resultado: POST duplicado, consumo em dobro do bucket da credencial e 429 que
 * a idempotência do `accounts.` não evita, porque ela dedupe o *efeito*, não o
 * trabalho.
 *
 * Repetindo `delivered_at`/`claimed_until` no `UPDATE` externo, o Postgres
 * reavalia essas colunas após o lock (`EvalPlanQual`) e vê o lease que o
 * primeiro acabou de gravar: a linha sai do conjunto e não é devolvida duas
 * vezes.
 */
export function createKyselyOutboxStore(ref: OutboxTableRef): OutboxStore {
  const { table, db } = ref;
  // O builder é dinâmico por natureza aqui (o nome da tabela é parâmetro), então
  // o tipo estrito do Kysely não se aplica — os apps o recuperam na fronteira.
  const query = db as unknown as {
    updateTable: (t: string) => Record<string, (...args: unknown[]) => unknown>;
  };

  /** `claimed_until` livre OU expirado, no instante `now`. */
  const leaseLivre = (eb: KyselyExpressionBuilder, now: Date): unknown =>
    eb.or([eb.eb('claimed_until', 'is', null), eb.eb('claimed_until', '<', now)]);

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
            // Entrada em backoff ainda não é elegível. `NULL` = nunca falhou.
            .where((inner: KyselyExpressionBuilder) =>
              inner.or([
                inner.eb('next_attempt_at', 'is', null),
                inner.eb('next_attempt_at', '<=', now),
              ]),
            )
            .where((inner: KyselyExpressionBuilder) => leaseLivre(inner, now))
            .orderBy('created_at', 'asc')
            .limit(limit),
        )
        // Reavaliadas após o lock — é o que impede o claim duplo descrito acima.
        .where('delivered_at', 'is', null)
        .where((eb: KyselyExpressionBuilder) => leaseLivre(eb, now))
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

/**
 * Transporte injetado pelo app.
 *
 * `cancelBody` existe por causa do `undici` (achado de review, PR #289,
 * CodeRabbit): ele mantém o corpo da resposta pendente e a conexão presa até que
 * alguém o consuma ou cancele. Esta entrega só olha o `status`, então o corpo
 * NUNCA é lido — sem cancelar, cada entrega vazaria uma conexão do pool.
 *
 * Opcional porque o `fetch` global não sofre disso; o adaptador do `downloads` o
 * fornece.
 */
export type OutboxFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; cancelBody?: () => Promise<void> }>;

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
 * Teto de tentativas — alcançado APENAS por defeito de payload (400/422), que a
 * política abaixo grava de uma vez. Sem ele, um evento permanentemente inválido
 * seria retentado para sempre e empurraria a fila inteira.
 *
 * Falha de ambiente (5xx, 429, 401/403, rede) NÃO caminha para este teto: ela
 * nem toca neste contador, e sim `transient_count`, que só espaça a próxima
 * tentativa (ver `transientUpdate`). Foi o achado P1 da PR #289 — com o
 * incremento antigo, 25 minutos de `accounts.` fora abandonavam avisos válidos.
 *
 * Exportado porque o índice parcial da migration espelha este número
 * (`WHERE delivered_at IS NULL AND attempt_count < 5`): mudar um exige mudar o
 * outro, e o valor precisa ser legível dos dois lados.
 */
export const OUTBOX_MAX_ATTEMPTS = 5;

/**
 * Teto do backoff, em minutos. Acima disto a espera para de dobrar: uma queda
 * longa não deve empurrar a próxima tentativa para horas adiante, senão o aviso
 * chega tarde demais para ser útil mesmo com o `accounts.` já recuperado.
 */
export const OUTBOX_BACKOFF_CAP_MINUTES = 60;

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

/**
 * Gravação de uma falha de AMBIENTE (5xx, 429, 401/403, 404, 408, rede).
 *
 * Não toca `attempt_count` — e é esse o ponto inteiro. Achado de review
 * (PR #289, Codex P1, segunda rodada): a primeira correção acrescentou o backoff
 * mas manteve o incremento, então a quinta falha transitória ainda gravava
 * `attempt_count = 5` e `claimPending` — que filtra `attempt_count < maxAttempts`
 * — descartava a entrada de vez. O backoff só tinha adiado o abandono.
 *
 * Os dois contadores medem coisas diferentes e por isso não podem ser um só:
 *
 * - `attempt_count` conta o que é CULPA DA MENSAGEM (400/422) e é critério de
 *   descarte. Só o caminho `permanent` escreve nele, e escreve o teto de uma vez.
 * - `transient_count` conta o que é CULPA DO AMBIENTE, e serve só para espaçar
 *   a próxima tentativa. Cresce sem limite de propósito: uma indisponibilidade
 *   longa faz a entrada voltar cada vez mais devagar (até o teto de
 *   `OUTBOX_BACKOFF_CAP_MINUTES`), nunca sair da fila.
 *
 * O preço de crescer sem limite é uma entrada que tenta para sempre contra um
 * `accounts.` permanentemente quebrado. É o preço certo: aviso preso na fila com
 * `last_error` legível é operável — alguém vê e conserta —, enquanto aviso
 * descartado em silêncio é perda de dado que ninguém descobre.
 */
function transientUpdate(entry: OutboxEntry, reason: string): OutboxUpdate {
  const transient = entry.transient_count + 1;
  return {
    // `attempt_count` deliberadamente ausente: falha de ambiente não gasta o
    // orçamento de descarte.
    transient_count: transient,
    last_error: reason,
    // Libera o claim: a entrada volta à fila sem esperar o lease inteiro.
    claimed_until: null,
    next_attempt_at: new Date(Date.now() + backoffDelayMs(transient)),
  };
}

/**
 * Corpo do POST de ingestão, a partir da linha do outbox.
 *
 * Separado do laço só para que `deliverOutboxEntries` fique legível: montar o
 * payload não é decisão, é tradução de formato.
 */
function buildIngestBody(entry: OutboxEntry, recipients: string[]): string {
  return JSON.stringify({
    event_id: entry.event_id,
    event_type: entry.event_type,
    event_version: entry.event_version,
    subject_type: entry.subject_type,
    subject_id: entry.subject_id,
    canonical_path: entry.canonical_path,
    snapshot: normalizeSnapshot(entry.snapshot),
    recipients,
    // Momento real do fato no módulo de origem, não o da entrega: sem isto, um
    // sweep atrasado ordenaria os avisos pela hora em que a fila esvaziou, não
    // pela hora em que o fato aconteceu.
    occurred_at: entry.created_at.toISOString(),
    // Omitido quando nulo: o schema do ingest é `.strict()` e o campo é
    // opcional, então mandar `read_at: null` explícito seria aceito, mas dizer
    // nada é mais honesto — o produtor não está afirmando estado de leitura.
    ...(entry.read_at ? { read_at: entry.read_at.toISOString() } : {}),
  });
}

/**
 * Envia uma entrada e devolve o status HTTP.
 *
 * O timeout vive aqui inteiro (`AbortController` + `clearTimeout` no `finally`)
 * para que o chamador não precise de um `try/finally` só por causa dele.
 */
async function postEntry(
  entry: OutboxEntry,
  recipients: string[],
  options: DeliveryOptions,
): Promise<number> {
  const { fetchImpl, baseUrl, credential } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${baseUrl}/internal/v1/notifications/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': credential,
      },
      body: buildIngestBody(entry, recipients),
      signal: controller.signal,
    });

    // O corpo não é lido em nenhum caminho — só o status importa. Cancelar logo
    // aqui libera a conexão para o pool, inclusive no caminho de sucesso.
    if (response.cancelBody) {
      await response.cancelBody().catch(() => {
        // Corpo já consumido ou conexão encerrada: não há o que liberar.
      });
    }

    return response.status;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Traduz um status de recusa na gravação correspondente.
 *
 * Só esgota o teto o que é comprovadamente defeito do payload — 400 e 422. Todo
 * o resto do 4xx descreve o *ambiente*, não a mensagem, e o ambiente muda
 * sozinho:
 *
 * - `401`/`403`: credencial em rotação, ainda não emitida, ou sem
 *   `notification.write`. Corrigida a configuração, a mesma entrega passa.
 * - `404`: durante deploy escalonado o `accounts.` antigo ainda não tem a rota
 *   de ingestão. O deploy termina e a rota aparece.
 * - `429`: a rota passa por `communityRateLimit`, e um lote de até 50 entregas
 *   estoura o bucket da credencial com facilidade.
 * - `408`: timeout declarado pelo servidor é transitório por definição.
 *
 * Tratar qualquer um deles como terminal gravaria `attempt_count = 5` e o aviso
 * nunca mais voltaria ao sweep — perda silenciosa causada por uma janela de
 * operação que já passou (achado de review, PR #257). Por isso eles nem sequer
 * INCREMENTAM `attempt_count`: ver `transientUpdate`.
 */
function rejectionUpdate(entry: OutboxEntry, status: number, logTag: string): OutboxUpdate {
  // Credencial quebrada não se resolve sozinha: a entrada fica retentando em
  // backoff até alguém corrigir a configuração. Log explícito para que esse
  // alguém veja a causa, já que a fila não vai mais estourar teto nenhum para
  // chamar atenção.
  if (status === 401 || status === 403) {
    console.error(
      `${logTag} HTTP ${status} — credencial de serviço ausente, revogada ou sem escopo notification.write. Falha transitória ${entry.transient_count + 1}; a entrega continuará sendo retentada em backoff.`,
    );
  }

  if (status === 400 || status === 422) {
    return {
      // Defeito de payload: sai da fila de vez. `next_attempt_at` fica nulo
      // porque agendar retorno de algo que nunca vai passar é ruído.
      attempt_count: OUTBOX_MAX_ATTEMPTS,
      last_error: `HTTP ${status}`,
      claimed_until: null,
      next_attempt_at: null,
    };
  }

  return transientUpdate(entry, `HTTP ${status}`);
}

/** Chave do resultado que esta entrada incrementou. */
type DeliveryOutcome = keyof DeliveryResult;

/**
 * Entrega UMA entrada e devolve o que ela somou ao resultado.
 *
 * Existe separada porque o laço de `deliverOutboxEntries` só precisa saber
 * "quantas entregaram, falharam ou foram descartadas" — a decisão por entrada é
 * assunto local (Sonar: complexidade cognitiva do laço).
 */
async function deliverOne(entry: OutboxEntry, options: DeliveryOptions): Promise<DeliveryOutcome> {
  const { store, logTag } = options;
  const recipients = entry.recipients;

  if (!isUuidArray(recipients) || recipients.length === 0) {
    // Payload que o `accounts.` recusaria com 400 em toda tentativa. Marca
    // entregue com erro registrado em vez de retentar cinco vezes o que não tem
    // como dar certo — e o `last_error` deixa o caso auditável.
    //
    // Dentro de try/catch (achado de review, PR #289, CodeRabbit): este `update`
    // estava solto, então uma falha dele abortava a VARREDURA inteira, e as
    // demais entradas já reservadas ficavam com o claim preso até o lease
    // expirar — 10 minutos de fila parada por causa de uma linha.
    try {
      await store.update(entry.id, {
        delivered_at: new Date(),
        last_error: 'recipients inválido',
        claimed_until: null,
      });
      return 'skipped';
    } catch (error: unknown) {
      console.error(`${logTag} falha ao marcar entrada com recipients inválido:`, error);
      return 'failed';
    }
  }

  try {
    const status = await postEntry(entry, recipients, options);

    if (status === 202 || status === 200) {
      await store.update(entry.id, {
        delivered_at: new Date(),
        last_error: null,
        claimed_until: null,
      });
      return 'delivered';
    }

    await store.update(entry.id, rejectionUpdate(entry, status, logTag));
    return 'failed';
  } catch (error: unknown) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : String(error);
    // Falha de rede/timeout é ambiente por definição: mesmo tratamento do 5xx.
    await store.update(entry.id, transientUpdate(entry, reason));
    return 'failed';
  }
}

export async function deliverOutboxEntries(options: DeliveryOptions): Promise<DeliveryResult> {
  const claimedUntil = new Date(Date.now() + OUTBOX_CLAIM_LEASE_MS);
  const pending = await options.store.claimPending(
    OUTBOX_BATCH_SIZE,
    OUTBOX_MAX_ATTEMPTS,
    claimedUntil,
  );

  const result: DeliveryResult = { delivered: 0, failed: 0, skipped: 0 };

  // Sequencial de propósito: paralelizar aqui multiplicaria o pico contra o
  // `communityRateLimit` da credencial, que é justamente o 429 que a política de
  // retry existe para absorver.
  for (const entry of pending) {
    result[await deliverOne(entry, options)]++;
  }

  return result;
}

/** Intervalo do sweep, igual nos dois apps e no `accounts.`. */
export const OUTBOX_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** O que cada app precisa informar para montar o seu par entrega+sweep. */
export interface OutboxRunnerConfig<TDb> {
  /** Nome da tabela de outbox do app (`mesas_notification_outbox`, etc.). */
  table: string;
  /** `fetch` global ou `undici` — cada app usa o que já traz. */
  fetchImpl: OutboxFetch;
  /** Prefixo dos logs, para o operador saber de qual app veio. */
  logTag: string;
  /**
   * `db` do app, usado quando o chamador não passa um.
   *
   * Fica no config, e não só como parâmetro default de cada função, para que os
   * apps não precisem reescrever as duas assinaturas só para aplicar o default —
   * era o clone de 14% que sobrava depois da primeira extração (Sonar, PR #289).
   * Os testes continuam injetando um `db` falso por chamada.
   */
  defaultDb: TDb;
}

/**
 * Monta `deliverPendingNotifications` + `startNotificationOutboxSweep` para um
 * app, a partir do que de fato é dele.
 *
 * Achado de review (PR #289, Sonar): depois de extrair a lógica de entrega, os
 * dois wrappers continuavam duplicados — 27,1% no `mesas`, 20,0% no `downloads`.
 * A leitura de env, a guarda de configuração ausente, o `setInterval`, o
 * `unref()` e o tratamento de erro da varredura eram idênticos; divergiam apenas
 * o nome da tabela, o transporte e o rótulo do log — que é exatamente o que este
 * config recebe.
 *
 * O `db` fica como parâmetro das funções devolvidas, e não do config, porque os
 * testes de cada app injetam um `db` falso por chamada.
 */
export function createOutboxRunner<TDb>(config: OutboxRunnerConfig<TDb>): {
  deliverPendingNotifications: (database?: TDb) => Promise<DeliveryResult>;
  startNotificationOutboxSweep: (database?: TDb) => { unref: () => void };
} {
  const { table, fetchImpl, logTag, defaultDb } = config;

  async function deliverPendingNotifications(database: TDb = defaultDb): Promise<DeliveryResult> {
    const baseUrl = process.env.ACCOUNTS_URL?.trim().replace(/\/$/, '');
    const serviceCredential = process.env.SERVICE_CREDENTIAL?.trim() || undefined;

    if (!baseUrl || !serviceCredential) {
      // Avisa e não lança: a entrada fica pendente e sai na próxima varredura
      // quando a configuração existir — nada se perde por falta de env.
      console.warn(`${logTag} ACCOUNTS_URL ou SERVICE_CREDENTIAL não configurado — entrega adiada.`);
      return { delivered: 0, failed: 0, skipped: 0 };
    }

    return deliverOutboxEntries({
      store: createKyselyOutboxStore({ table, db: database as never }),
      fetchImpl,
      baseUrl,
      credential: serviceCredential,
      logTag,
    });
  }

  function startNotificationOutboxSweep(database: TDb = defaultDb): { unref: () => void } {
    const timer = setInterval(() => {
      void deliverPendingNotifications(database).catch((error: unknown) => {
        console.error(`${logTag} falha na varredura periódica:`, error);
      });
    }, OUTBOX_SWEEP_INTERVAL_MS);

    // `unref` para o timer não segurar o processo no encerramento — sem isso, o
    // container demoraria até 5 min para sair em cada deploy.
    timer.unref();
    return timer;
  }

  return { deliverPendingNotifications, startNotificationOutboxSweep };
}
