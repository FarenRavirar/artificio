import request from 'supertest';
import express from 'express';

// T5.1 (spec 083) — reprovacao individual e batch exigem categoria
// estruturada valida/ativa, alem do motivo em texto livre ja existente.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, updateTable: dbMocks.updateTable, insertInto: dbMocks.insertInto },
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

const sendModerationEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../services/moderationEmail', () => ({
  sendModerationEmail: sendModerationEmailMock,
}));

import moderationRoutes from './moderation';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/moderation', moderationRoutes);
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
  dbMocks.insertInto.mockReset();
  sendModerationEmailMock.mockClear();
});

describe('POST /api/v1/moderation/:id/reject', () => {
  it('400 quando rejection_category_id ausente', async () => {
    const res = await request(app())
      .post('/api/v1/moderation/material-1/reject')
      .send({ reason: 'motivo qualquer' })
      .expect(400);

    expect(res.body.error).toBe('Payload inválido.');
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('400 quando categoria nao existe ou esta inativa', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', title: 'Meu material', editorial_state: 'in_review' };
    dbMocks.selectFrom
      .mockReturnValueOnce(chainable(material))
      .mockReturnValueOnce(chainable(undefined));

    const res = await request(app())
      .post('/api/v1/moderation/material-1/reject')
      .send({ reason: 'motivo', rejection_category_id: 'cat-inexistente' })
      .expect(400);

    expect(res.body.error).toMatch(/Categoria de reprovação/);
  });

  it('reprova com categoria valida, grava rejection_category_id e envia e-mail', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', title: 'Meu material', slug: 'meu-material', editorial_state: 'in_review' };
    const category = { id: 'cat-1', slug: 'copyright', label: 'Violação de direitos autorais', legal_basis: 'Lei 9.610/98', active: true };

    dbMocks.selectFrom
      .mockReturnValueOnce(chainable(material))
      .mockReturnValueOnce(chainable(category));

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'rejected', rejection_category_id: 'cat-1' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);
    dbMocks.insertInto.mockReturnValue({ values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) });

    await request(app())
      .post('/api/v1/moderation/material-1/reject')
      .send({ reason: 'Conteúdo protegido.', rejection_category_id: 'cat-1' })
      .expect(200);

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ editorial_state: 'rejected', rejection_category_id: 'cat-1' }),
    );
    expect(sendModerationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'material_rejected',
        categoryLabel: 'Violação de direitos autorais',
        legalBasis: 'Lei 9.610/98',
        reason: 'Conteúdo protegido.',
      }),
    );
  });

  it('nao falha a rota quando envio de e-mail lanca (best-effort)', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', title: 'Meu material', slug: 'meu-material', editorial_state: 'in_review' };
    const category = { id: 'cat-1', slug: 'copyright', label: 'Violação de direitos autorais', legal_basis: null, active: true };

    dbMocks.selectFrom
      .mockReturnValueOnce(chainable(material))
      .mockReturnValueOnce(chainable(category));

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'rejected' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);
    dbMocks.insertInto.mockReturnValue({ values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) });
    sendModerationEmailMock.mockRejectedValueOnce(new Error('Resend fora do ar'));

    await request(app())
      .post('/api/v1/moderation/material-1/reject')
      .send({ reason: 'motivo', rejection_category_id: 'cat-1' })
      .expect(200);
  });
});

describe('PATCH /api/v1/moderation/batch/reject', () => {
  it('400 quando rejection_category_id ausente no batch', async () => {
    const res = await request(app())
      .patch('/api/v1/moderation/batch/reject')
      .send({ ids: ['material-1'], reason: 'motivo' })
      .expect(400);

    expect(res.body.error).toMatch(/Categoria de reprovação/);
  });

  it('400 quando categoria do batch e invalida/inativa', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(chainable(undefined));

    const res = await request(app())
      .patch('/api/v1/moderation/batch/reject')
      .send({ ids: ['material-1'], reason: 'motivo', rejection_category_id: 'cat-invalida' })
      .expect(400);

    expect(res.body.error).toMatch(/Categoria de reprovação/);
  });
});
