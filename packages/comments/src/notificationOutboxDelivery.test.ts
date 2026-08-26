import { describe, expect, it, vi } from 'vitest';

import {
  backoffDelayMs,
  deliverOutboxEntries,
  OUTBOX_BACKOFF_CAP_MINUTES,
  OUTBOX_MAX_ATTEMPTS,
  type OutboxEntry,
  type OutboxStore,
  type OutboxUpdate,
} from './notificationOutboxDelivery.js';

// T7.4b (spec 096). A política de retry é onde um erro custa caro e não aparece:
// tratar 401/403/404/429 como permanente gravaria `attempt_count = 5` e o aviso
// nunca mais voltaria ao sweep — perda silenciosa causada por uma janela de
// operação (credencial em rotação, deploy escalonado, rate limit) que já passou.
// Foi o achado de review da PR #257 no gêmeo deste arquivo, no `downloads`.

const ENTRY = {
  id: 'outbox-1',
  event_id: 'e1e1e1e1-1111-4111-8111-111111111111',
  event_type: 'mesas.suggestion.approved',
  event_version: 1,
  subject_type: 'system_suggestion',
  subject_id: 'sug-1',
  canonical_path: '/catalogo?system=dnd',
  snapshot: { title: 'Sugestão aprovada' },
  recipients: ['0f0e35b3-7375-476c-b6f8-932caf88b9a8'],
  created_at: new Date('2026-08-25T12:00:00.000Z'),
  delivered_at: null,
  attempt_count: 0,
  transient_count: 0,
  last_error: null,
  claimed_until: null,
};

/**
 * Store em memória: `claimPending` devolve as entradas pendentes e cada
 * `update` é capturado para asserção. É a porta que cada app implementa com o
 * próprio Kysely — testar contra ela dispensa banco.
 */
function makeStore(entries: OutboxEntry[]) {
  const updates: OutboxUpdate[] = [];
  const store: OutboxStore = {
    claimPending: async () => entries,
    update: async (_id, values) => {
      updates.push(values);
    },
  };
  return { store, updates };
}

/** Chamada com as mesmas opções que os dois apps passam. */
function deliver(store: OutboxStore, fetchImpl: ReturnType<typeof vi.fn>) {
  return deliverOutboxEntries({
    store,
    fetchImpl: fetchImpl as never,
    baseUrl: 'https://accounts.artificiorpg.com',
    credential: 'cred-de-teste',
    logTag: '[teste]',
  });
}

describe('deliverPendingNotifications — transporte (T7.4b)', () => {
  it('POSTa no ingest do accounts com o token de serviço e o occurred_at do fato', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 202 });
    const { store } = makeStore([ENTRY]);

    const result = await deliver(store, spy);

    expect(result.delivered).toBe(1);
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://accounts.artificiorpg.com/internal/v1/notifications/events',
    );
    const init = spy.mock.calls[0][1] as { headers: Record<string, string>; body: string };
    expect(init.headers['X-Service-Token']).toBe('cred-de-teste');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.event_id).toBe(ENTRY.event_id);
    // Hora do fato, não da entrega: um sweep atrasado ordenaria os avisos pela
    // hora em que a fila esvaziou, não pela hora da aprovação.
    expect(body.occurred_at).toBe('2026-08-25T12:00:00.000Z');
  });

  // O caso "sem ACCOUNTS_URL/SERVICE_CREDENTIAL" saiu daqui e vive no wrapper de
  // cada app (`notificationOutboxDelivery.test.ts` do mesas): a leitura de env é
  // responsabilidade deles, e este pacote recebe `baseUrl`/`credential` prontos.

  it('não entrega nada quando a fila está vazia', async () => {
    const spy = vi.fn();
    const { store } = makeStore([]);

    const result = await deliver(store, spy);

    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('trata 200 como entregue, além de 202', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 200 });
    const { store, updates } = makeStore([ENTRY]);

    const result = await deliver(store, spy);

    expect(result.delivered).toBe(1);
    expect(updates[0].delivered_at).toBeInstanceOf(Date);
    expect(updates[0].last_error).toBeNull();
  });
});

describe('deliverPendingNotifications — política de retry (T7.4b)', () => {
  it.each([
    ['400 payload inválido', 400],
    ['422 payload recusado', 422],
  ])('esgota o teto em %s (retry não melhora payload defeituoso)', async (_label, status) => {
    const spy = vi.fn().mockResolvedValue({ status });
    const { store, updates } = makeStore([ENTRY]);

    const result = await deliver(store, spy);

    expect(result.failed).toBe(1);
    expect(updates[0].attempt_count).toBe(OUTBOX_MAX_ATTEMPTS);
    // Fora da fila de vez: agendar retorno de payload defeituoso seria ruído.
    expect(updates[0].next_attempt_at).toBeNull();
  });

  it.each([
    ['401 credencial em rotação', 401],
    ['403 sem escopo notification.write', 403],
    ['404 accounts antigo em deploy escalonado', 404],
    ['429 rate limit da credencial', 429],
    ['408 timeout do servidor', 408],
    ['500 erro do accounts', 500],
    ['503 accounts fora do ar', 503],
  ])('mantém o aviso na fila em %s (o ambiente muda sozinho)', async (_label, status) => {
    const spy = vi.fn().mockResolvedValue({ status });
    const { store, updates } = makeStore([ENTRY]);

    await deliver(store, spy);

    // NÃO toca `attempt_count` — este é o ponto do achado P1 (PR #289, segunda
    // rodada). Incrementar aqui fazia a quinta falha transitória gravar 5, e
    // `claimPending` filtra `attempt_count < 5`: o aviso saía da fila para
    // sempre. Acrescentar só o backoff tinha apenas ADIADO esse abandono.
    expect(updates[0].attempt_count).toBeUndefined();
    expect(updates[0].transient_count).toBe(1);
    expect(updates[0].last_error).toBe(`HTTP ${status}`);
    // Libera o claim: volta à fila na próxima varredura, sem esperar o lease.
    expect(updates[0].claimed_until).toBeNull();
    expect(updates[0].next_attempt_at).toBeInstanceOf(Date);
  });

  it('registra timeout de rede como tentativa, não como defeito permanente', async () => {
    const abortError = Object.assign(new Error('abortado'), { name: 'AbortError' });
    const spy = vi.fn().mockRejectedValue(abortError);
    const { store, updates } = makeStore([ENTRY]);

    const result = await deliver(store, spy);

    expect(result.failed).toBe(1);
    // Rede é ambiente por definição: adia, não descarta.
    expect(updates[0].attempt_count).toBeUndefined();
    expect(updates[0].transient_count).toBe(1);
    expect(updates[0].last_error).toBe('timeout');
    expect(updates[0].next_attempt_at).toBeInstanceOf(Date);
  });

  // Achado real (review PR #289): a checagem aceitava qualquer string. O
  // `google_sub` de 21 dígitos passava daqui e levava 400 do ingest — que a
  // política acima trata como PERMANENTE, queimando o aviso de vez.
  it('descarta recipients com id não-UUID (google_sub legado de 21 dígitos)', async () => {
    const spy = vi.fn();
    const { store, updates } = makeStore([{ ...ENTRY, recipients: ['104402786752391076361'] }]);

    const result = await deliver(store, spy);

    expect(result.skipped).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    expect(updates[0].last_error).toBe('recipients inválido');
  });

  it('descarta entrada com recipients malformado em vez de retentar 5 vezes', async () => {
    const spy = vi.fn();
    const { store, updates } = makeStore([{ ...ENTRY, recipients: 'nao-e-array' as never }]);

    const result = await deliver(store, spy);

    // O accounts recusaria com 400 em toda tentativa; `last_error` deixa o caso
    // auditável em vez de silencioso.
    expect(result.skipped).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    expect(updates[0].last_error).toBe('recipients inválido');
    expect(updates[0].delivered_at).toBeInstanceOf(Date);
  });
});

// Achados de review (PR #289, CodeRabbit, nitpicks).
describe('deliverOutboxEntries — robustez da varredura', () => {
  it('uma falha ao marcar entrada inválida não aborta a varredura inteira', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 202 });
    const boa = { ...ENTRY, id: 'outbox-2' };
    const ruim = { ...ENTRY, id: 'outbox-1', recipients: ['nao-uuid'] };
    let updates = 0;

    const store: OutboxStore = {
      claimPending: async () => [ruim, boa],
      update: async (id) => {
        updates += 1;
        if (id === 'outbox-1') throw new Error('banco indisponível');
      },
    };

    const result = await deliver(store, spy);

    // Sem o try/catch, o throw da primeira abortava tudo e a segunda ficava com
    // o claim preso até o lease expirar (10 min de fila parada).
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
    expect(updates).toBe(2);
  });

  // Achado de review (PR #289, CodeRabbit). Defeito que EU introduzi ao extrair
  // `deliverOne` do laço: só o caminho de `recipients` inválido tinha try/catch,
  // e o `catch` externo fazia parecer que os outros estavam cobertos — ele
  // chamava `update` de novo, e a segunda falha propagava, abortando a varredura.
  it('falha ao marcar entrega não conta como entregue nem aborta a varredura', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 202 });
    const updates: OutboxUpdate[] = [];
    const store: OutboxStore = {
      claimPending: async () => [{ ...ENTRY, id: 'outbox-1' }, { ...ENTRY, id: 'outbox-2' }],
      // Falha SÓ na marcação de entrega. Um mock que lançasse em todo `update`
      // não distinguiria os dois códigos: o `catch` externo chamaria `update` de
      // novo, e a segunda falha seria engolida do mesmo jeito.
      update: async (id, values) => {
        if (id === 'outbox-1' && values.delivered_at) {
          throw new Error('banco indisponível');
        }
        updates.push(values);
      },
    };

    const result = await deliver(store, spy);

    // A primeira POSTou com sucesso mas não conseguiu marcar a linha. Dizer
    // `delivered` faria o sweep seguinte reentregar o mesmo aviso e contá-lo
    // duas vezes — por isso conta como falha.
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
    // E a segunda entrada foi processada: a varredura não abortou.
    expect(spy).toHaveBeenCalledTimes(2);
    // Sem `gravar`, o `update` lançava DENTRO do try, o `catch` externo o tomava
    // por falha de rede e gravava `transient_count`/`next_attempt_at` — ou seja,
    // agendava retentativa para uma entrega que o `accounts.` já aceitou. Com o
    // helper, a falha é registrada onde aconteceu e nada é reagendado.
    expect(updates.some((u) => u.transient_count !== undefined)).toBe(false);
  });

  it('cancela o corpo da resposta, inclusive no sucesso (libera a conexão)', async () => {
    const cancelBody = vi.fn().mockResolvedValue(undefined);
    const spy = vi.fn().mockResolvedValue({ status: 202, cancelBody });
    const { store } = makeStore([ENTRY]);

    await deliver(store, spy);

    // O undici prende a conexão até o corpo ser consumido ou cancelado, e esta
    // entrega só olha o status.
    expect(cancelBody).toHaveBeenCalledOnce();
  });

  it('falha ao cancelar o corpo não derruba a entrega', async () => {
    const cancelBody = vi.fn().mockRejectedValue(new Error('já consumido'));
    const spy = vi.fn().mockResolvedValue({ status: 202, cancelBody });
    const { store, updates } = makeStore([ENTRY]);

    const result = await deliver(store, spy);

    expect(result.delivered).toBe(1);
    expect(updates[0].delivered_at).toBeInstanceOf(Date);
  });
});

// Achado de review (PR #289, Codex P1).
describe('backoffDelayMs — falha de ambiente adia, não descarta', () => {
  it('dobra a espera a cada tentativa', () => {
    expect(backoffDelayMs(1)).toBe(2 * 60_000);
    expect(backoffDelayMs(2)).toBe(4 * 60_000);
    expect(backoffDelayMs(3)).toBe(8 * 60_000);
  });

  it('para de dobrar no teto (queda longa não empurra o aviso para horas)', () => {
    const teto = OUTBOX_BACKOFF_CAP_MINUTES * 60_000;
    expect(backoffDelayMs(10)).toBe(teto);
    expect(backoffDelayMs(50)).toBe(teto);
  });

  it('nunca devolve espera não-positiva (entrada travaria fora da fila)', () => {
    for (let i = 0; i <= 12; i += 1) {
      expect(backoffDelayMs(i)).toBeGreaterThan(0);
    }
  });
});

// Achado P1 da PR #289, segunda rodada: a primeira correção acrescentou o
// backoff mas manteve o incremento de `attempt_count`, então o abandono apenas
// mudou de hora. Este caso é o que prova que ele sumiu.
describe('falha transitória prolongada não abandona o aviso', () => {
  it('não esgota o teto nem na décima falha seguida', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 503 });
    // Entrada que já sofreu 9 quedas do `accounts.` — bem além das 5 do teto.
    const { store, updates } = makeStore([{ ...ENTRY, transient_count: 9 }]);

    await deliver(store, spy);

    // `attempt_count` intocado: o claim continua enxergando a entrada, porque
    // `attempt_count < OUTBOX_MAX_ATTEMPTS` segue verdadeiro.
    expect(updates[0].attempt_count).toBeUndefined();
    expect(updates[0].transient_count).toBe(10);
    expect(updates[0].next_attempt_at).toBeInstanceOf(Date);
  });

  // Achado de review (PR #289, CodeRabbit): "adicione um teste cobrindo a quinta
  // falha transitória seguida de uma entrega bem-sucedida". Os dois casos acima
  // olham UMA varredura isolada; este percorre o ciclo inteiro, que é onde o
  // defeito original aparecia — a entrada sumia da fila ENTRE varreduras, e
  // nenhuma asserção sobre um `update` avulso pegaria isso.
  it('sobrevive a cinco quedas seguidas e entrega quando o accounts volta', async () => {
    // Store que se comporta como o banco: aplica cada `update` na linha e
    // reavalia o filtro do claim (`attempt_count < OUTBOX_MAX_ATTEMPTS`) na
    // varredura seguinte. Um store que sempre devolve a entrada esconderia
    // exatamente o abandono que este teste existe para detectar.
    // `delivered_at`/`last_error` não estão em `OutboxEntry` (a entrega só LÊ o
    // que precisa para montar o POST), mas existem na linha real e são o que o
    // claim e a asserção final consultam.
    const linha: OutboxEntry & { delivered_at: Date | null; last_error: string | null } = {
      ...ENTRY,
      delivered_at: null,
      last_error: null,
    };
    const store: OutboxStore = {
      claimPending: async (_limit, maxAttempts) =>
        (linha.delivered_at === null && linha.attempt_count < maxAttempts ? [linha] : []),
      update: async (_id, values) => {
        Object.assign(linha, values);
      },
    };

    const spy = vi.fn().mockResolvedValue({ status: 503 });
    for (let queda = 1; queda <= 5; queda += 1) {
      const parcial = await deliver(store, spy);
      // A entrada continua sendo reservada em TODA varredura — inclusive a 5a,
      // que era exatamente onde ela desaparecia antes.
      expect(parcial.failed).toBe(1);
      expect(linha.transient_count).toBe(queda);
    }

    // `attempt_count` nunca se moveu: cinco quedas do ambiente não gastam o
    // orçamento de descarte, que pertence só a defeito de payload.
    expect(linha.attempt_count).toBe(0);
    expect(linha.delivered_at).toBeNull();

    // `accounts.` volta.
    spy.mockResolvedValue({ status: 202 });
    const final = await deliver(store, spy);

    expect(final.delivered).toBe(1);
    expect(linha.delivered_at).toBeInstanceOf(Date);
    expect(linha.last_error).toBeNull();
  });

  it('o backoff satura no teto em vez de crescer sem limite', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 503 });
    const { store, updates } = makeStore([{ ...ENTRY, transient_count: 40 }]);
    const antes = Date.now();

    await deliver(store, spy);

    const agendado = (updates[0].next_attempt_at as Date).getTime() - antes;
    // Não vira "daqui a 2^41 minutos": o aviso precisa continuar entregável
    // assim que o `accounts.` voltar.
    //
    // A margem existe porque `antes` é capturado FORA da execução: o `Date.now()`
    // interno corre alguns ms depois, e a comparação exata falhava por 1ms
    // (medido). O que o caso prova é a ordem de grandeza — teto de 60 min contra
    // as horas que o backoff sem limite geraria —, não o milissegundo.
    expect(agendado).toBeLessThanOrEqual(OUTBOX_BACKOFF_CAP_MINUTES * 60_000 + 5_000);
  });
});
