import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { authMiddleware } from './auth.js';

/**
 * Estado do duplo do banco, controlado por teste.
 *
 * `existingUser` decide se `resolveMesasUser` cai no caminho "conta já existe"
 * (onde a reconciliação de `google_id` acontece) ou no caminho de provisão.
 * `updates` registra o que o `UPDATE` recebeu — é o que prova a reconciliação,
 * já que ela não muda a resposta HTTP.
 */
interface ExistingUser {
  id: string;
  email: string;
  role: string;
  google_id: string;
}

let existingUser: ExistingUser | undefined;
let updates: Array<{ set: Record<string, unknown> }>;
let updateError: unknown;

vi.mock('../db', () => ({
  db: {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: async () => existingUser,
        }),
      }),
    }),
    updateTable: () => {
      const builder = {
        set: (values: Record<string, unknown>) => {
          updates.push({ set: values });
          return builder;
        },
        where: () => builder,
        execute: async () => {
          if (updateError) throw updateError;
          return [];
        },
      };
      return builder;
    },
    insertInto: () => ({
      values: () => ({
        onConflict: () => ({
          returning: () => ({
            execute: async () => [{ id: 'local-user-1', email: 'paulo@example.com', role: 'player' }],
          }),
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  existingUser = undefined;
  updates = [];
  updateError = undefined;
});

const originalSecret = process.env.JWT_SECRET;

describe('SSO auth middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-only-for-sso';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('returns 401 without artificio_session cookie', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/private', authMiddleware, (_req, res) => res.json({ ok: true }));

    await request(app).get('/private').expect(401);
  });

  it('accepts valid accounts JWT from artificio_session cookie', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/private', authMiddleware, (req, res) => res.json({ user: req.user }));
    const token = jwt.sign(
      {
        sub: 'accounts-user-1',
        email: 'paulo@example.com',
        name: 'Paulo Teste',
        role: 'user',
      },
      'test-secret-only-for-sso',
      { algorithm: 'HS256', expiresIn: '15m' },
    );

    const response = await request(app)
      .get('/private')
      .set('Cookie', [`artificio_session=${token}`])
      .expect(200);

    expect(response.body.user).toMatchObject({
      userId: 'local-user-1',
      role: 'player',
      email: 'paulo@example.com',
      name: 'Paulo Teste',
    });
  });

  it('provisions local user on first SSO login instead of falling back to the accounts UUID (regressão 2026-07-12)', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/private', authMiddleware, (req, res) => res.json({ user: req.user }));
    const token = jwt.sign(
      {
        sub: 'accounts-user-new',
        email: 'novo@example.com',
        name: 'Novo Usuário',
        role: 'user',
      },
      'test-secret-only-for-sso',
      { algorithm: 'HS256', expiresIn: '15m' },
    );

    const response = await request(app)
      .get('/private')
      .set('Cookie', [`artificio_session=${token}`])
      .expect(200);

    // userId precisa ser o id LOCAL provisionado (local-user-1, do mock de
    // insertInto), nunca o sub/UUID do accounts — esse era exatamente o bug:
    // fallback pro UUID do accounts quebrava FK em qualquer rota que gravasse
    // user_id (ex.: POST /gm/profile).
    expect(response.body.user.userId).toBe('local-user-1');
    expect(response.body.user.userId).not.toBe('accounts-user-new');
  });
});

/**
 * Reconciliação de `google_id` legado (achado de review, PR #273).
 *
 * A coluna guarda o `users.id` do `accounts.` apesar do nome. Conta anterior ao
 * SSO ficou com o `google_sub` de 21 dígitos e era casada pelo `email` no
 * login, **sem nunca ser regravada** — 15 de 68 usuários em produção, 14 mesas
 * sem dono resolvido no guard de comentários (medido 2026-08-18).
 *
 * O login funcionava nos dois casos, então nada aqui se prova pela resposta
 * HTTP: o que se afirma é o `UPDATE`, e é ele que os testes inspecionam.
 */
describe('reconciliação de google_id legado no login', () => {
  const ACCOUNTS_UUID = '3f2a1c4e-8b7d-4a91-9c22-6e5f0d8a1b34';
  const LEGACY_GOOGLE_SUB = '106884162561229573720';

  const login = async (sub: string, email: string) => {
    const app = express();
    app.use(cookieParser());
    app.get('/private', authMiddleware, (req, res) => res.json({ user: req.user }));
    const token = jwt.sign(
      { sub, email, name: 'Mestre Legado', role: 'user' },
      'test-secret-only-for-sso',
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    return await request(app).get('/private').set('Cookie', [`artificio_session=${token}`]);
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-only-for-sso';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('regrava google_id quando a conta legada é casada por e-mail', async () => {
    existingUser = {
      id: 'local-user-legado',
      email: 'legado@example.com',
      role: 'gm',
      google_id: LEGACY_GOOGLE_SUB,
    };

    const response = await login(ACCOUNTS_UUID, 'legado@example.com');

    expect(response.status).toBe(200);
    // Sem esta linha o guard de comentários devolve `ownerUserId: null` para
    // sempre, e o mestre nunca é notificado do próprio anúncio.
    expect(updates).toEqual([{ set: { google_id: ACCOUNTS_UUID } }]);
  });

  it('não escreve nada quando google_id já é o UUID do accounts', async () => {
    existingUser = {
      id: 'local-user-ok',
      email: 'ok@example.com',
      role: 'player',
      google_id: ACCOUNTS_UUID,
    };

    const response = await login(ACCOUNTS_UUID, 'ok@example.com');

    expect(response.status).toBe(200);
    // 53 dos 68 usuários caem aqui: um UPDATE por request seria escrita
    // inútil no caminho quente de toda rota autenticada.
    expect(updates).toEqual([]);
  });

  it('mantém o login de pé quando a reconciliação colide com outra linha (23505)', async () => {
    existingUser = {
      id: 'local-user-duplicado',
      email: 'duplicado@example.com',
      role: 'player',
      google_id: LEGACY_GOOGLE_SUB,
    };
    updateError = Object.assign(new Error('duplicate key'), { code: '23505' });

    const response = await login(ACCOUNTS_UUID, 'duplicado@example.com');

    // Conta duplicada da migração é resíduo de dado, não motivo para derrubar o
    // usuário: o estado continua o de antes (mesa sem dono resolvido), que já
    // era o comportamento vigente.
    expect(response.status).toBe(200);
    expect(response.body.user.userId).toBe('local-user-duplicado');
  });

  it('propaga erro de banco que não seja colisão, em vez de virar 401 mudo', async () => {
    existingUser = {
      id: 'local-user-erro',
      email: 'erro@example.com',
      role: 'player',
      google_id: LEGACY_GOOGLE_SUB,
    };
    updateError = Object.assign(new Error('connection terminated'), { code: '57P01' });

    const response = await login(ACCOUNTS_UUID, 'erro@example.com');

    expect(response.status).toBe(500);
  });
});
