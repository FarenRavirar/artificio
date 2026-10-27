// Spec 106 R19. Fingerprint, truncamento, ausencia de query string e os tetos
// contra abuso: 1000 mensagens distintas nao criam mais que o teto de linhas
// nem de avisos.
const h = vi.hoisted(() => ({
  rows: new Map<string, number>(),
  firstSeenAt: [] as number[],
  alerts: 0,
  notified: 0,
  insertCalls: 0,
}));

vi.mock('./adminNotifications.js', () => ({
  notifyAdmins: vi.fn(async () => void (h.notified += 1)),
}));
vi.mock('./activityLogger.js', () => ({
  logActivity: vi.fn(async () => void (h.alerts += 1)),
}));
vi.mock('../db/index.js', () => {
  const selectFrom = (table: string) => {
    const c: Record<string, unknown> = {};
    let byFingerprint: string | undefined;
    let isTotal = false;
    Object.assign(c, {
      select: (arg: unknown) => {
        isTotal = typeof arg === 'object' && arg !== null && JSON.stringify(arg).includes('total');
        return c;
      },
      where: (col: string, _op: string, v: unknown) => {
        if (col === 'fingerprint') byFingerprint = v as string;
        return c;
      },
      executeTakeFirst: async () => (byFingerprint && h.rows.has(byFingerprint) ? { id: byFingerprint } : undefined),
      executeTakeFirstOrThrow: async () => {
        if (table === 'activity_log') return { avisos: h.alerts };
        return isTotal ? { total: h.rows.size } : { recentes: h.rows.size };
      },
    });
    return c;
  };
  const insertInto = () => {
    let fp = '';
    const c: Record<string, unknown> = {};
    Object.assign(c, {
      values: (v: { fingerprint: string }) => {
        fp = v.fingerprint;
        return c;
      },
      onConflict: () => c,
      returning: () => c,
      executeTakeFirstOrThrow: async () => {
        h.insertCalls += 1;
        const inserted = !h.rows.has(fp);
        h.rows.set(fp, (h.rows.get(fp) ?? 0) + 1);
        return { id: fp, inserted };
      },
    });
    return c;
  };
  return { db: { selectFrom, insertInto } };
});

import express from 'express';
import request from 'supertest';
import {
  CEILINGS,
  LIMITS,
  clientErrorFingerprint,
  parseClientErrorBody,
  recordClientError,
  type ClientErrorInput,
} from './clientErrors.js';
import clientErrorsRoutes from '../routes/clientErrors.js';

const base = (over: Partial<ClientErrorInput> = {}): ClientErrorInput => ({
  message: 'boom',
  stack: '',
  componentStack: '\n    at Foo',
  routePattern: '/perfil',
  path: '/perfil',
  userAgent: 'ua',
  build: 'b1',
  ...over,
});

beforeEach(() => {
  h.rows.clear();
  h.alerts = 0;
  h.notified = 0;
  h.insertCalls = 0;
});

describe('parseClientErrorBody', () => {
  it('trunca cada campo no limite e tira query string e fragmento do path', () => {
    const r = parseClientErrorBody({
      message: 'm'.repeat(9999),
      stack: 's'.repeat(9999),
      componentStack: 'c'.repeat(9999),
      userAgent: 'u'.repeat(9999),
      routePattern: '/mestre/:slug',
      path: '/mestre/x?token=SEGREDO#frag',
    })!;
    expect(r.message).toHaveLength(LIMITS.message);
    expect(r.stack).toHaveLength(LIMITS.stack);
    expect(r.componentStack).toHaveLength(LIMITS.componentStack);
    expect(r.userAgent).toHaveLength(LIMITS.userAgent);
    expect(r.path).toBe('/mestre/x');
  });

  it.each([[null], [[]], ['x'], [{}], [{ message: '   ' }], [{ message: 5 }]])('recusa %j', (body) => {
    expect(parseClientErrorBody(body)).toBeNull();
  });
});

describe('clientErrorFingerprint', () => {
  it('igual para o mesmo erro; muda com rota, mensagem ou 1a linha do componente', () => {
    const a = clientErrorFingerprint(base());
    expect(clientErrorFingerprint(base({ stack: 'outra stack' }))).toBe(a);
    expect(clientErrorFingerprint(base({ routePattern: '/x' }))).not.toBe(a);
    expect(clientErrorFingerprint(base({ message: 'outra' }))).not.toBe(a);
    expect(clientErrorFingerprint(base({ componentStack: '\n    at Bar' }))).not.toBe(a);
  });
});

describe('recordClientError', () => {
  it('1a ocorrencia cria e avisa; a 2a incrementa sem novo aviso', async () => {
    expect(await recordClientError(base(), 'u1')).toBe('created');
    expect(await recordClientError(base(), 'u1')).toBe('incremented');
    expect(h.notified).toBe(1);
  });

  it('1000 mensagens distintas criam no maximo o teto de linhas e de avisos', async () => {
    for (let i = 0; i < 1000; i += 1) await recordClientError(base({ message: `erro ${i}` }), null);
    expect(h.rows.size).toBeLessThanOrEqual(CEILINGS.newFingerprintsPerHour);
    expect(h.notified).toBeLessThanOrEqual(CEILINGS.adminAlertsPerHour);
  });

  it('fingerprint ja existente segue somando depois do teto', async () => {
    for (let i = 0; i < CEILINGS.newFingerprintsPerHour; i += 1) await recordClientError(base({ message: `e${i}` }), null);
    expect(await recordClientError(base({ message: 'novo' }), null)).toBe('throttled');
    expect(await recordClientError(base({ message: 'e0' }), null)).toBe('incremented');
  });
});

describe('POST /api/v1/client-errors', () => {
  vi.mock('../middleware/rateLimit.js', () => ({
    strictRateLimiter: (_q: unknown, _s: unknown, next: () => void) => next(),
  }));
  vi.mock('../middleware/auth.js', () => ({
    optionalAuth: (_q: unknown, _s: unknown, next: () => void) => next(),
  }));
  const app = express().use(express.json()).use('/api/v1/client-errors', clientErrorsRoutes);

  it('204 com corpo valido, 400 sem mensagem, 413 acima do limite', async () => {
    expect((await request(app).post('/api/v1/client-errors').send({ message: 'x' })).status).toBe(204);
    expect((await request(app).post('/api/v1/client-errors').send({})).status).toBe(400);
    const gigante = await request(app).post('/api/v1/client-errors').send({ message: 'x'.repeat(20000) });
    expect(gigante.status).toBe(413);
  });
});
