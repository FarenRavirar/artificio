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

    // Incrementa UMA tentativa — não salta para o teto. Tratar qualquer um
    // destes como terminal apagaria o aviso por uma janela já encerrada.
    expect(updates[0].attempt_count).toBe(1);
    expect(updates[0].last_error).toBe(`HTTP ${status}`);
    // Libera o claim: volta à fila na próxima varredura, sem esperar o lease.
    expect(updates[0].claimed_until).toBeNull();
    // ...mas só depois do backoff (achado P1, PR #289): sem agendar, o sweep a
    // cada 5 min queimava as 5 tentativas em 25 min de indisponibilidade e o
    // aviso saía da fila para sempre.
    expect(updates[0].next_attempt_at).toBeInstanceOf(Date);
  });

  it('registra timeout de rede como tentativa, não como defeito permanente', async () => {
    const abortError = Object.assign(new Error('abortado'), { name: 'AbortError' });
    const spy = vi.fn().mockRejectedValue(abortError);
    const { store, updates } = makeStore([ENTRY]);

    const result = await deliver(store, spy);

    expect(result.failed).toBe(1);
    expect(updates[0].attempt_count).toBe(1);
    expect(updates[0].last_error).toBe('timeout');
    // Rede é ambiente por definição: adia, não descarta.
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
