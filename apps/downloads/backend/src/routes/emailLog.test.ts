import request from 'supertest';
import express from 'express';

// Achado de review (PR #192) — rota de reenvio manual de e-mail sem teste.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, updateTable: dbMocks.updateTable },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'moderator-1', role: 'moderator' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const resolveUserEmailMock = vi.hoisted(() => vi.fn());
vi.mock('../services/accountsClient', () => ({
  resolveUserEmail: resolveUserEmailMock,
}));

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock('@artificio/email', () => ({
  sendEmail: sendEmailMock,
  materialRejectedEmail: vi.fn().mockReturnValue({ subject: 'assunto', html: '<p>corpo</p>' }),
  materialApprovedEmail: vi.fn().mockReturnValue({ subject: 'assunto', html: '<p>corpo</p>' }),
}));

import emailLogRoutes from './emailLog';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/admin/email-log', emailLogRoutes);
  return server;
}

function chainable(result: unknown) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(result),
  };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.updateTable.mockReset();
  resolveUserEmailMock.mockReset();
  sendEmailMock.mockReset();
});

describe('POST /api/v1/admin/email-log/:id/retry', () => {
  it('404 quando log nao existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(chainable(undefined));

    await request(app()).post('/api/v1/admin/email-log/log-1/retry').expect(404);
  });

  it('409 quando log ja esta sent', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(chainable({ id: 'log-1', status: 'sent', material_id: 'material-1' }));

    const res = await request(app()).post('/api/v1/admin/email-log/log-1/retry').expect(409);
    expect(res.body.error).toMatch(/já foi enviado/);
  });

  it('409 quando log nao tem material associado', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(chainable({ id: 'log-1', status: 'failed', material_id: null }));

    const res = await request(app()).post('/api/v1/admin/email-log/log-1/retry').expect(409);
    expect(res.body.error).toMatch(/sem material associado/);
  });

  it('409 quando material associado nao existe mais', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(chainable({ id: 'log-1', status: 'failed', material_id: 'material-1', user_id: 'user-1', attempts: 1 }))
      .mockReturnValueOnce(chainable(undefined));

    const res = await request(app()).post('/api/v1/admin/email-log/log-1/retry').expect(409);
    expect(res.body.error).toMatch(/não existe mais/);
  });

  it('409 e atualiza log para skipped_no_email quando accounts. nao resolve o e-mail', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(chainable({ id: 'log-1', status: 'failed', material_id: 'material-1', user_id: 'user-1', attempts: 1, kind: 'material_approved' }))
      .mockReturnValueOnce(chainable({ id: 'material-1', title: 'Material X', slug: 'material-x', creator_id: 'user-1', rejection_reason: null, rejection_category_id: null }));
    resolveUserEmailMock.mockResolvedValue(null);

    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    dbMocks.updateTable.mockReturnValue(updateChain);

    const res = await request(app()).post('/api/v1/admin/email-log/log-1/retry').expect(409);
    expect(res.body.error).toMatch(/Não foi possível resolver e-mail/);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped_no_email', attempts: 2 }));
  });

  it('200 e grava sent quando envio funciona', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(chainable({ id: 'log-1', status: 'failed', material_id: 'material-1', user_id: 'user-1', attempts: 1, kind: 'material_approved' }))
      .mockReturnValueOnce(chainable({ id: 'material-1', title: 'Material X', slug: 'material-x', creator_id: 'user-1', rejection_reason: null, rejection_category_id: null }));
    resolveUserEmailMock.mockResolvedValue({ email: 'autor@example.com', displayName: 'Autor' });
    sendEmailMock.mockResolvedValue({ messageId: 'msg-1' });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'log-1', status: 'sent' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    await request(app()).post('/api/v1/admin/email-log/log-1/retry').expect(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', attempts: 2 }));
  });

  it('502 e grava failed quando envio lanca', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(chainable({ id: 'log-1', status: 'failed', material_id: 'material-1', user_id: 'user-1', attempts: 1, kind: 'material_rejected' }))
      .mockReturnValueOnce(chainable({ id: 'material-1', title: 'Material X', slug: 'material-x', creator_id: 'user-1', rejection_reason: 'motivo', rejection_category_id: null }));
    resolveUserEmailMock.mockResolvedValue({ email: 'autor@example.com', displayName: 'Autor' });
    sendEmailMock.mockRejectedValue(new Error('Resend fora do ar'));

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'log-1', status: 'failed' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    await request(app()).post('/api/v1/admin/email-log/log-1/retry').expect(502);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: 2, error_detail: 'Resend fora do ar' }),
    );
  });
});
