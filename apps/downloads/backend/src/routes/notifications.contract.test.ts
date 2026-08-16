import express from 'express';
import request from 'supertest';

/**
 * Contract test do comportamento ANTERIOR à delegação ao `accounts.` (T5.3).
 *
 * A spec 090 exige, com todas as letras, que estes testes existam **antes** da
 * troca: "`verify:api` não prova compatibilidade semântica — hoje não existe
 * teste direto de `comments.ts` nem de `notifications.ts`, então escrever
 * contract tests contra o comportamento antigo **antes** de trocar". O que está
 * fixado aqui é o contrato que o frontend já consome hoje — shape do payload,
 * status, e quem pode chamar. A fachada nova precisa passar nestes mesmos
 * testes; se um deles precisar mudar, a mudança é quebra de contrato e vai ao
 * mantenedor, não ao teste.
 *
 * O limiter de leitura é o `readRateLimiter` desde T5.3b: o `GET` usava
 * `writeRateLimiter` (60/15min contra 300/15min), então quem só consultava o
 * próprio feed gastava cota de escrita.
 */

const dbMocks = vi.hoisted(() => ({ selectFrom: vi.fn(), updateTable: vi.fn() }));
vi.mock('../db', () => ({ db: dbMocks }));

const limiterCalls = vi.hoisted(() => ({ read: 0, write: 0 }));
vi.mock('../middleware/rateLimit', () => ({
  readRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    limiterCalls.read += 1;
    next();
  },
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    limiterCalls.write += 1;
    next();
  },
}));

const authState = vi.hoisted(() => ({ userId: 'user-1' as string | null }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!authState.userId) {
      res.status(401).json({ error: 'Token inválido ou expirado.' });
      return;
    }
    req.user = { userId: authState.userId, role: 'user' };
    next();
  },
}));

import notificationsRoutes from './notifications';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/notifications', notificationsRoutes);
  return server;
}

beforeEach(() => {
  limiterCalls.read = 0;
  limiterCalls.write = 0;
  authState.userId = 'user-1';
  dbMocks.selectFrom.mockReset();
  dbMocks.updateTable.mockReset();
});

describe('GET /api/v1/notifications — contrato preservado na delegação', () => {
  it('devolve os campos que o frontend consome, do próprio usuário', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    // O `where` é capturado, e não apenas encadeado: sem a asserção lá embaixo,
    // remover o filtro de dono da rota deixaria este teste **verde** enquanto a
    // listagem passaria a devolver notificação alheia. O título fala "do próprio
    // usuário"; a trava tem de dizer o mesmo.
    const where = vi.fn().mockReturnThis();
    dbMocks.selectFrom.mockReturnValue({
      selectAll: vi.fn().mockReturnThis(),
      where,
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([
        {
          id: 'notif-1',
          user_id: 'user-1',
          kind: 'material_approved',
          material_id: 'material-1',
          body: 'Seu material foi aprovado.',
          read_at: null,
          created_at: createdAt,
        },
      ]),
    });

    const response = await request(app()).get('/api/v1/notifications').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toMatchObject({
      id: 'notif-1',
      kind: 'material_approved',
      material_id: 'material-1',
      body: 'Seu material foi aprovado.',
      read_at: null,
    });
    expect(response.body[0].created_at).toBe(createdAt.toISOString());
    expect(where).toHaveBeenCalledWith('user_id', '=', 'user-1');
  });

  it('exige sessão', async () => {
    authState.userId = null;
    await request(app()).get('/api/v1/notifications').expect(401);
  });

  it('consome o bucket de LEITURA, não o de escrita (T5.3b)', async () => {
    dbMocks.selectFrom.mockReturnValue({
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    });

    await request(app()).get('/api/v1/notifications').expect(200);

    expect(limiterCalls.read).toBe(1);
    expect(limiterCalls.write).toBe(0);
  });
});

describe('PATCH /api/v1/notifications/:id/read — contrato preservado', () => {
  it('devolve 204 sem corpo quando a notificação é do usuário', async () => {
    dbMocks.selectFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    });
    dbMocks.updateTable.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    });

    const response = await request(app()).patch('/api/v1/notifications/notif-1/read').expect(204);

    expect(response.text).toBe('');
  });

  it('devolve 404 para notificação de outro usuário — sem distinguir de inexistente', async () => {
    dbMocks.selectFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    });

    const response = await request(app()).patch('/api/v1/notifications/de-outro/read').expect(404);

    expect(response.body).toMatchObject({ error: 'Notificação não encontrada.' });
    expect(dbMocks.updateTable).not.toHaveBeenCalled();
  });

  it('consome o bucket de escrita', async () => {
    dbMocks.selectFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    });

    await request(app()).patch('/api/v1/notifications/x/read').expect(404);

    expect(limiterCalls.write).toBe(1);
    expect(limiterCalls.read).toBe(0);
  });
});
