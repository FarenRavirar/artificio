import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

// T3.5/T3.13 (spec 090) — entrega do outbox local ao par consolidado.
//
// Prova o CONSUMIDOR: seleção de pendências, tradução do payload, tratamento de
// 4xx contra 5xx, teto de tentativas e normalização de `recipients`. A rota que
// recebe é provada em `accounts/src/notificationIngestRoutes.test.ts`; a
// transação que enfileira, em `moderation.notify.test.ts`.

const undiciFetchMock = vi.hoisted(() => vi.fn());
vi.mock('undici', () => ({ fetch: undiciFetchMock }));
vi.mock('../db', () => ({ db: {} }));

import { deliverPendingNotifications } from './notificationOutboxDelivery';

interface FakeEntry {
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

const RECIPIENT = '11111111-1111-4111-8111-111111111111';

function makeEntry(overrides: Partial<FakeEntry> = {}): FakeEntry {
  return {
    id: 'outbox-1',
    event_id: '33333333-3333-4333-8333-333333333333',
    event_type: 'downloads.material_approved',
    event_version: 1,
    subject_type: 'material',
    subject_id: 'material-1',
    canonical_path: '/materiais/material-1',
    snapshot: { legacy_kind: 'material_approved', legacy_body: 'aprovado' },
    recipients: [RECIPIENT],
    created_at: new Date('2026-08-12T10:00:00.000Z'),
    attempt_count: 0,
    ...overrides,
  };
}

/** Captura o `set()` de cada UPDATE para asserir o que foi gravado. */
function fakeDb(entries: FakeEntry[], captured: Array<Record<string, unknown>>) {
  return {
    selectFrom: () => {
      const builder = {
        selectAll: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: () => builder,
        execute: vi.fn().mockResolvedValue(entries),
      };
      return builder;
    },
    updateTable: () => ({
      set: (values: Record<string, unknown>) => {
        captured.push(values);
        return { where: () => ({ execute: vi.fn().mockResolvedValue([]) }) };
      },
    }),
  } as unknown as Kysely<Database>;
}

beforeEach(() => {
  undiciFetchMock.mockReset();
  process.env.ACCOUNTS_URL = 'http://accounts.test';
  process.env.SERVICE_CREDENTIAL = 'downloads-prod-abcd1234.segredo';
});

describe('deliverPendingNotifications', () => {
  it('202 marca entregue e limpa o último erro', async () => {
    undiciFetchMock.mockResolvedValue({ status: 202 });
    const captured: Array<Record<string, unknown>> = [];

    const result = await deliverPendingNotifications(fakeDb([makeEntry()], captured));

    expect(result).toEqual({ delivered: 1, failed: 0, skipped: 0 });
    expect(captured[0]).toMatchObject({ last_error: null });
    expect(captured[0].delivered_at).toBeInstanceOf(Date);
  });

  it('envia occurred_at do fato, não da entrega', async () => {
    // 19b (`spec.md:282`): sem isto, um sweep atrasado ordenaria os avisos pela
    // hora em que a fila esvaziou, não pela hora em que a moderação decidiu.
    undiciFetchMock.mockResolvedValue({ status: 202 });

    await deliverPendingNotifications(fakeDb([makeEntry()], []));

    const body = JSON.parse(undiciFetchMock.mock.calls[0][1].body as string);
    expect(body.occurred_at).toBe('2026-08-12T10:00:00.000Z');
    expect(body.event_id).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('reenvia o mesmo event_id no retry — idempotência do produtor', async () => {
    // É o que faz o UNIQUE do `accounts.` transformar retry em no-op em vez de
    // aviso duplicado. Gerar id novo a cada tentativa quebraria isso.
    undiciFetchMock.mockResolvedValue({ status: 500 });
    const entry = makeEntry({ attempt_count: 2 });

    await deliverPendingNotifications(fakeDb([entry], []));
    await deliverPendingNotifications(fakeDb([entry], []));

    const first = JSON.parse(undiciFetchMock.mock.calls[0][1].body as string);
    const second = JSON.parse(undiciFetchMock.mock.calls[1][1].body as string);
    expect(second.event_id).toBe(first.event_id);
  });

  it('5xx incrementa tentativa: erro transitório merece retry', async () => {
    undiciFetchMock.mockResolvedValue({ status: 503 });
    const captured: Array<Record<string, unknown>> = [];

    const result = await deliverPendingNotifications(fakeDb([makeEntry({ attempt_count: 1 })], captured));

    expect(result.failed).toBe(1);
    expect(captured[0]).toMatchObject({ attempt_count: 2, last_error: 'HTTP 503' });
  });

  it('4xx esgota o teto: payload inválido não melhora com retry', async () => {
    // Sem isto, um evento permanentemente recusado seria retentado cinco vezes
    // e empurraria a fila inteira em toda varredura.
    undiciFetchMock.mockResolvedValue({ status: 400 });
    const captured: Array<Record<string, unknown>> = [];

    await deliverPendingNotifications(fakeDb([makeEntry()], captured));

    expect(captured[0]).toMatchObject({ attempt_count: 5, last_error: 'HTTP 400' });
  });

  it('recipients malformado é descartado com erro registrado, sem chamar a rede', async () => {
    // Payload externo é `unknown` até passar por checagem tipada (AGENTS.md).
    const captured: Array<Record<string, unknown>> = [];

    const result = await deliverPendingNotifications(
      fakeDb([makeEntry({ recipients: 'não é array' })], captured),
    );

    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 1 });
    expect(undiciFetchMock).not.toHaveBeenCalled();
    expect(captured[0]).toMatchObject({ last_error: 'recipients inválido' });
  });

  it('sem ACCOUNTS_URL não lança e não perde a pendência', async () => {
    delete process.env.ACCOUNTS_URL;

    const result = await deliverPendingNotifications(fakeDb([makeEntry()], []));

    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 0 });
    expect(undiciFetchMock).not.toHaveBeenCalled();
  });

  it('timeout conta tentativa e registra o motivo', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    undiciFetchMock.mockRejectedValue(abortError);
    const captured: Array<Record<string, unknown>> = [];

    const result = await deliverPendingNotifications(fakeDb([makeEntry()], captured));

    expect(result.failed).toBe(1);
    expect(captured[0]).toMatchObject({ attempt_count: 1, last_error: 'timeout' });
  });
});
