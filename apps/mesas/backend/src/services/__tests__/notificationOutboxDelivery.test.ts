import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../db/index.js', () => ({ db: {} }));

import { deliverPendingNotifications } from '../notificationOutboxDelivery.js';

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
 * Simula o banco: o claim (`updateTable ... returningAll`) devolve as entradas
 * pendentes, e cada update posterior é capturado para asserção.
 */
function makeDb(entries: Array<typeof ENTRY>) {
  const updates: Array<Record<string, unknown>> = [];
  let first = true;
  const database = {
    updateTable: () => {
      const chain: Record<string, unknown> = {
        set: (values: Record<string, unknown>) => {
          if (!first) updates.push(values);
          return chain;
        },
        where: () => chain,
        returningAll: () => chain,
        execute: async () => {
          if (first) {
            first = false;
            return entries;
          }
          return [];
        },
      };
      return chain;
    },
  };
  return { database, updates };
}

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.ACCOUNTS_URL = 'https://accounts.artificiorpg.com';
  process.env.SERVICE_CREDENTIAL = 'cred-de-teste';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe('deliverPendingNotifications — transporte (T7.4b)', () => {
  it('POSTa no ingest do accounts com o token de serviço e o occurred_at do fato', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 202 });
    globalThis.fetch = spy as unknown as typeof fetch;
    const { database } = makeDb([ENTRY]);

    const result = await deliverPendingNotifications(database as never);

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

  it('não chama a rede quando falta ACCOUNTS_URL ou SERVICE_CREDENTIAL', async () => {
    delete process.env.SERVICE_CREDENTIAL;
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const { database } = makeDb([ENTRY]);

    const result = await deliverPendingNotifications(database as never);

    // Nada se perde: a entrada fica pendente e sai na próxima varredura.
    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('trata 200 como entregue, além de 202', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 }) as unknown as typeof fetch;
    const { database, updates } = makeDb([ENTRY]);

    const result = await deliverPendingNotifications(database as never);

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
    globalThis.fetch = vi.fn().mockResolvedValue({ status }) as unknown as typeof fetch;
    const { database, updates } = makeDb([ENTRY]);

    const result = await deliverPendingNotifications(database as never);

    expect(result.failed).toBe(1);
    expect(updates[0].attempt_count).toBe(5);
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
    globalThis.fetch = vi.fn().mockResolvedValue({ status }) as unknown as typeof fetch;
    const { database, updates } = makeDb([ENTRY]);

    await deliverPendingNotifications(database as never);

    // Incrementa UMA tentativa — não salta para o teto. Tratar qualquer um
    // destes como terminal apagaria o aviso por uma janela já encerrada.
    expect(updates[0].attempt_count).toBe(1);
    expect(updates[0].last_error).toBe(`HTTP ${status}`);
    // Libera o claim: volta à fila na próxima varredura, sem esperar o lease.
    expect(updates[0].claimed_until).toBeNull();
  });

  it('registra timeout de rede como tentativa, não como defeito permanente', async () => {
    const abortError = Object.assign(new Error('abortado'), { name: 'AbortError' });
    globalThis.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    const { database, updates } = makeDb([ENTRY]);

    const result = await deliverPendingNotifications(database as never);

    expect(result.failed).toBe(1);
    expect(updates[0].attempt_count).toBe(1);
    expect(updates[0].last_error).toBe('timeout');
  });

  it('descarta entrada com recipients malformado em vez de retentar 5 vezes', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const { database, updates } = makeDb([{ ...ENTRY, recipients: 'nao-e-array' as never }]);

    const result = await deliverPendingNotifications(database as never);

    // O accounts recusaria com 400 em toda tentativa; `last_error` deixa o caso
    // auditável em vez de silencioso.
    expect(result.skipped).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    expect(updates[0].last_error).toBe('recipients inválido');
    expect(updates[0].delivered_at).toBeInstanceOf(Date);
  });
});
