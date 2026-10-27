// Spec 106 R13 / plan §11: aviso ao autor só nos estados finais e com autor; o
// alerta de fila parada marca antes de avisar (um aviso por relato).
const h = vi.hoisted(() => ({
  enqueued: [] as Array<Record<string, unknown>>,
  notified: [] as Array<Record<string, unknown>>,
  claimed: [] as Array<{ id: string; title: string; kind: string }>,
}));

vi.mock('./notificationOutbox.js', async (orig) => ({
  ...(await orig<typeof import('./notificationOutbox.js')>()),
  enqueueNotification: vi.fn(async (input: Record<string, unknown>) => void h.enqueued.push(input)),
}));
vi.mock('./adminNotifications.js', () => ({
  notifyAdmins: vi.fn(async (input: Record<string, unknown>) => void h.notified.push(input)),
}));
vi.mock('../db/index.js', () => {
  const c: Record<string, unknown> = {};
  for (const m of ['set', 'where', 'returning']) c[m] = () => c;
  c.execute = async () => h.claimed;
  return { db: { updateTable: () => c } };
});

import { alertStaleFeedback, enqueueAuthorNotice, isAuthorNoticeStatus } from './devFeedbackNotices.js';
import type { Transaction } from 'kysely';
import type { Database } from '../db/types.js';

const trx = {} as Transaction<Database>;
const row = { id: 'f1', user_id: 'u1', title: 'Link quebrado', route_path: '/mesas/x' };

beforeEach(() => {
  h.enqueued.length = 0;
  h.notified.length = 0;
  h.claimed = [];
});

describe('aviso ao autor', () => {
  it.each(['resolved', 'wont_fix', 'duplicate'] as const)('avisa em %s', async (status) => {
    await enqueueAuthorNotice(trx, row, status);
    expect(h.enqueued).toHaveLength(1);
    expect(h.enqueued[0]).toMatchObject({ eventType: 'mesas.system.notice', recipients: ['u1'], canonicalPath: '/mesas/x' });
    expect(String(h.enqueued[0].body)).toContain('Link quebrado');
  });

  it.each(['new', 'triaged', 'in_progress'] as const)('não avisa em %s', async (status) => {
    expect(isAuthorNoticeStatus(status)).toBe(false);
    await enqueueAuthorNotice(trx, row, status);
    expect(h.enqueued).toHaveLength(0);
  });

  it('relato anônimo não gera aviso', async () => {
    await enqueueAuthorNotice(trx, { ...row, user_id: null }, 'resolved');
    expect(h.enqueued).toHaveLength(0);
  });

  it('route_path inválido cai em "/"', async () => {
    await enqueueAuthorNotice(trx, { ...row, route_path: '//evil.com' }, 'resolved');
    expect(h.enqueued[0]).toMatchObject({ canonicalPath: '/' });
  });
});

describe('alerta de fila parada', () => {
  it('um aviso por relato marcado', async () => {
    h.claimed = [{ id: 'a', title: 'A', kind: 'bug' }, { id: 'b', title: 'B', kind: 'suggestion' }];
    expect(await alertStaleFeedback()).toBe(2);
    expect(h.notified).toHaveLength(2);
    expect(h.notified[0]).toMatchObject({ type: 'feedback_stale', action_url: '/gestao/sistema?tab=feedback' });
  });

  it('fila vazia não avisa', async () => {
    expect(await alertStaleFeedback()).toBe(0);
    expect(h.notified).toHaveLength(0);
  });
});
