import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../db/index.js', () => ({ db: {} }));

import { deliverPendingNotifications } from '../notificationOutboxDelivery.js';

// T7.4b (spec 096). A LÓGICA de entrega (claim, retry, timeout) vive em
// `@artificio/comments` e é testada lá, contra a porta `OutboxStore` — este
// arquivo cobre só o que sobrou aqui: a leitura das envs e o claim escrito com o
// Kysely deste app.

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

/** Captura o que o claim monta, sem banco. */
function makeDb(entries: Array<typeof ENTRY>) {
  const claims: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  let first = true;
  const database = {
    updateTable: (table: string) => {
      const isClaim = first;
      const chain: Record<string, unknown> = {
        set: (values: Record<string, unknown>) => {
          (isClaim ? claims : updates).push({ table, ...values });
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
  return { database, claims, updates };
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

describe('deliverPendingNotifications — wrapper do mesas (T7.4b)', () => {
  it('lê ACCOUNTS_URL/SERVICE_CREDENTIAL e entrega no ingest do accounts', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 202 });
    globalThis.fetch = spy as unknown as typeof fetch;
    const { database } = makeDb([ENTRY]);

    const result = await deliverPendingNotifications(database as never);

    expect(result.delivered).toBe(1);
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://accounts.artificiorpg.com/internal/v1/notifications/events',
    );
    const init = spy.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['X-Service-Token']).toBe('cred-de-teste');
  });

  it('remove a barra final de ACCOUNTS_URL, para a URL não sair com barra dupla', async () => {
    process.env.ACCOUNTS_URL = 'https://accounts.artificiorpg.com/';
    const spy = vi.fn().mockResolvedValue({ status: 202 });
    globalThis.fetch = spy as unknown as typeof fetch;
    const { database } = makeDb([ENTRY]);

    await deliverPendingNotifications(database as never);

    expect(String(spy.mock.calls[0][0])).toBe(
      'https://accounts.artificiorpg.com/internal/v1/notifications/events',
    );
  });

  it.each([
    ['SERVICE_CREDENTIAL', 'SERVICE_CREDENTIAL'],
    ['ACCOUNTS_URL', 'ACCOUNTS_URL'],
  ])('não chama a rede quando falta %s', async (_label, envVar) => {
    delete process.env[envVar];
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const { database } = makeDb([ENTRY]);

    const result = await deliverPendingNotifications(database as never);

    // Nada se perde: a entrada fica pendente e sai na próxima varredura quando a
    // configuração existir.
    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reserva as linhas na tabela do mesas antes de qualquer HTTP', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 202 });
    globalThis.fetch = spy as unknown as typeof fetch;
    const { database, claims } = makeDb([ENTRY]);

    await deliverPendingNotifications(database as never);

    // O claim é o que impede o sweep periódico e o disparo pós-commit de
    // entregarem a mesma linha duas vezes.
    expect(claims[0].table).toBe('mesas_notification_outbox');
    expect(claims[0].claimed_until).toBeInstanceOf(Date);
  });

  it('grava o resultado da entrega na tabela do mesas', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 202 }) as unknown as typeof fetch;
    const { database, updates } = makeDb([ENTRY]);

    await deliverPendingNotifications(database as never);

    expect(updates[0].table).toBe('mesas_notification_outbox');
    expect(updates[0].delivered_at).toBeInstanceOf(Date);
  });
});
