import express from 'express';
import request from 'supertest';

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
  transaction: vi.fn(),
}));
const auditMocks = vi.hoisted(() => ({ logModerationAudit: vi.fn() }));

vi.mock('../db', () => ({ db: dbMocks }));
vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'user-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
vi.mock('../services/notify', () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/moderationAuditLog', () => auditMocks);

import reportsRoutes, { REPORT_PRIORITY_BY_CATEGORY } from './reports';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/reports', reportsRoutes);
  server.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Falha interna.' });
  });
  return server;
}

function selectBuilder(one: unknown = undefined, many: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(one),
    execute: vi.fn().mockResolvedValue(many),
  };
}

function mockInsert() {
  const values = vi.fn().mockReturnThis();
  dbMocks.insertInto.mockReturnValue({
    values,
    returningAll: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn().mockImplementation(async () => ({ id: 'report-1', ...values.mock.calls[0][0] })),
  });
  return values;
}

describe('reports — alvo único e prioridade interna', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert();
    dbMocks.transaction.mockReturnValue({
      execute: (callback: (trx: { updateTable: typeof dbMocks.updateTable }) => unknown) => callback({ updateTable: dbMocks.updateTable }),
    });
  });

  it.each(Object.entries(REPORT_PRIORITY_BY_CATEGORY))('mapeia %s para %s e ignora priority do cliente', async (category, priority) => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectBuilder({ id: 'material-1' }))
      .mockReturnValueOnce(selectBuilder(undefined))
      .mockReturnValueOnce(selectBuilder(undefined, []));
    const values = mockInsert();

    const response = await request(app()).post('/api/v1/reports').send({
      material_id: 'material-1', category, priority: 'P0',
    }).expect(201);

    expect(response.body.priority).toBe(priority);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ priority }));
    expect(dbMocks.updateTable).not.toHaveBeenCalledWith('download_material');
  });

  it('cria denúncia de comentário e grava snapshot de abuso sem bloquear', async () => {
    const history = selectBuilder(undefined, Array.from({ length: 8 }, () => ({ case_state: 'dismissed' })));
    dbMocks.selectFrom
      .mockReturnValueOnce(selectBuilder({ id: 'comment-1' }))
      .mockReturnValueOnce(selectBuilder(undefined))
      .mockReturnValueOnce(history);
    const values = mockInsert();

    await request(app()).post('/api/v1/reports').send({
      comment_id: 'comment-1', category: 'inappropriate_content',
    }).expect(201);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      material_id: null, comment_id: 'comment-1',
      reporter_abuse_flagged: true, reporter_dismissed_streak: 8,
    }));
    expect(history.limit).toHaveBeenCalledWith(20);
  });

  it('recusa alvo duplo/vazio e devolve 409 para duplicata', async () => {
    await request(app()).post('/api/v1/reports').send({ category: 'other' }).expect(400);
    await request(app()).post('/api/v1/reports').send({
      material_id: 'material-1', comment_id: 'comment-1', category: 'other',
    }).expect(400);

    dbMocks.selectFrom
      .mockReturnValueOnce(selectBuilder({ id: 'material-1' }))
      .mockReturnValueOnce(selectBuilder({ id: 'report-existing' }));
    await request(app()).post('/api/v1/reports').send({
      material_id: 'material-1', category: 'other',
    }).expect(409);
  });

  it('reclassifica caso aberto com auditoria', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectBuilder({
      id: 'report-1', reporter_user_id: 'user-2', material_id: 'material-1',
      comment_id: null, priority: 'P2', case_state: 'open',
    }));
    const set = vi.fn().mockReturnThis();
    dbMocks.updateTable.mockReturnValue({
      set, where: vi.fn().mockReturnThis(), returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
        id: 'report-1', reporter_user_id: 'user-2', material_id: 'material-1', comment_id: null,
        category: 'other', priority: 'P0', case_state: 'in_review', details: null,
        resolution_note: null, reporter_abuse_flagged: false, reporter_dismissed_streak: 0,
        created_at: new Date(), resolved_at: null,
      }),
    });

    await request(app()).patch('/api/v1/reports/report-1').send({ case_state: 'in_review', priority: 'P0' }).expect(200);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ priority: 'P0' }));
    expect(auditMocks.logModerationAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'report_reclassify', reason: 'P2 -> P0',
    }));
  });

  it('preserva prioridade quando o PATCH não reclassifica', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectBuilder({
      id: 'report-1', reporter_user_id: 'user-2', material_id: 'material-1',
      comment_id: null, priority: 'P2', case_state: 'open',
    }));
    const set = vi.fn().mockReturnThis();
    dbMocks.updateTable.mockReturnValue({
      set, where: vi.fn().mockReturnThis(), returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
        id: 'report-1', reporter_user_id: 'user-2', material_id: 'material-1', comment_id: null,
        category: 'other', priority: 'P2', case_state: 'in_review', details: null,
        resolution_note: null, reporter_abuse_flagged: false, reporter_dismissed_streak: 0,
        created_at: new Date(), resolved_at: null,
      }),
    });

    await request(app()).patch('/api/v1/reports/report-1').send({ case_state: 'in_review' }).expect(200);

    expect(set.mock.calls[0][0]).not.toHaveProperty('priority');
  });

  it('mantém 409 para reclassificação de caso já decidido', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectBuilder({
      id: 'report-1', reporter_user_id: 'user-2', material_id: 'material-1',
      comment_id: null, priority: 'P2', case_state: 'resolved',
    }));
    await request(app()).patch('/api/v1/reports/report-1').send({ case_state: 'resolved', priority: 'P0' }).expect(409);
    expect(dbMocks.updateTable).not.toHaveBeenCalled();
  });

  it('ao acatar denúncia remove comentário com marca, sem apagar a linha', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectBuilder({
        id: 'report-1', reporter_user_id: 'user-2', material_id: null,
        comment_id: 'comment-1', priority: 'P1', case_state: 'open',
      }))
      .mockReturnValueOnce(selectBuilder({ id: 'comment-1', material_id: 'material-1' }));
    const reportUpdate = {
      set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
        id: 'report-1', reporter_user_id: 'user-2', material_id: null, comment_id: 'comment-1',
        category: 'inappropriate_content', priority: 'P1', case_state: 'resolved', details: null,
        resolution_note: 'Conteúdo abusivo.', reporter_abuse_flagged: false, reporter_dismissed_streak: 0,
        created_at: new Date(), resolved_at: new Date(),
      }),
    };
    const commentUpdate = {
      set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined),
    };
    dbMocks.updateTable
      .mockReturnValueOnce(reportUpdate)
      .mockReturnValueOnce(commentUpdate);

    await request(app()).patch('/api/v1/reports/report-1').send({
      case_state: 'resolved', resolution_note: 'Conteúdo abusivo.',
    }).expect(200);

    expect(dbMocks.updateTable).toHaveBeenNthCalledWith(2, 'download_comment');
    expect(commentUpdate.set).toHaveBeenCalledWith(expect.objectContaining({
      removed_at: expect.any(Date), removed_reason: 'Conteúdo abusivo.',
    }));
  });

  it('não audita nem conclui a transação quando remover comentário falha', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectBuilder({
        id: 'report-1', reporter_user_id: 'user-2', material_id: null,
        comment_id: 'comment-1', priority: 'P1', case_state: 'open',
      }))
      .mockReturnValueOnce(selectBuilder({ id: 'comment-1', material_id: 'material-1' }));
    const reportUpdate = {
      set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'report-1', case_state: 'resolved' }),
    };
    const commentUpdate = {
      set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockRejectedValue(new Error('falha ao remover comentário')),
    };
    dbMocks.updateTable.mockReturnValueOnce(reportUpdate).mockReturnValueOnce(commentUpdate);

    await request(app()).patch('/api/v1/reports/report-1').send({ case_state: 'resolved' }).expect(500);

    expect(dbMocks.transaction).toHaveBeenCalledOnce();
    expect(auditMocks.logModerationAudit).not.toHaveBeenCalled();
  });
});
