import express from 'express';
import request from 'supertest';
import type { Mock } from 'vitest';
import draftsDuplicateRouter, { duplicatesRouter } from './duplicates';
import { db } from '../../db';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    insertInto: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../middleware/auth', () => ({
  requireAdmin: [(req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-test', role: 'admin' };
    next();
  }],
}));

const mockDb = db as unknown as {
  selectFrom: Mock;
  updateTable: Mock;
  insertInto: Mock;
  transaction: Mock;
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/discord/drafts', draftsDuplicateRouter);
  app.use('/admin/discord/duplicate-candidates', duplicatesRouter);
  return app;
}

function chain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'orderBy', 'limit', 'innerJoin', 'leftJoin', 'set', 'returningAll', 'values'];
  const result: Record<string, Mock> = {};
  for (const method of methods) {
    result[method] = vi.fn().mockReturnThis();
  }
  return Object.assign(result, overrides);
}

describe('discord duplicate candidates routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.transaction.mockReturnValue({
      execute: vi.fn((callback: (trx: typeof mockDb) => unknown) => callback(mockDb)),
    });
  });

  it('returns duplicate candidates for the latest parse case of a draft', async () => {
    const parseCaseQuery = chain({
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'case-1' }),
    });
    const candidatesQuery = chain({
      execute: vi.fn().mockResolvedValue([{
        id: 'dup-1',
        score: '0.91',
        signals_json: { normalized_hash_exact: true, same_channel: true },
        status: 'candidate',
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date('2026-07-01T00:00:00Z'),
        candidate_case_id: 'case-2',
        candidate_draft_id: 'draft-2',
        candidate_normalized_text: 'mesa igual',
        candidate_final_action: 'draft',
        candidate_draft_status: 'draft',
        candidate_draft_data: { table: { title: 'Mesa igual' } },
      }]),
    });
    mockDb.selectFrom
      .mockReturnValueOnce(parseCaseQuery)
      .mockReturnValueOnce(candidatesQuery);

    const response = await request(makeApp())
      .get('/admin/discord/drafts/draft-1/duplicates');

    expect(response.status).toBe(200);
    expect(parseCaseQuery.where).toHaveBeenCalledWith('draft_id', '=', 'draft-1');
    expect(candidatesQuery.where).toHaveBeenCalledWith('dc.parse_case_id', '=', 'case-1');
    expect(response.body.data).toMatchObject([{
      id: 'dup-1',
      score: 0.91,
      match_kind: 'exact',
      candidate_case_id: 'case-2',
      candidate_draft_status: 'draft',
    }]);
  });

  it('returns an empty list when the draft has no parse case', async () => {
    mockDb.selectFrom.mockReturnValueOnce(chain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    }));

    const response = await request(makeApp())
      .get('/admin/discord/drafts/draft-1/duplicates');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [] });
  });

  it('records feedback when a duplicate candidate is resolved', async () => {
    const candidate = {
      id: 'dup-1',
      parse_case_id: 'case-1',
      candidate_case_id: 'case-2',
      status: 'candidate',
    };
    mockDb.selectFrom.mockReturnValueOnce(chain({
      executeTakeFirst: vi.fn().mockResolvedValue(candidate),
    }));
    mockDb.updateTable.mockReturnValueOnce(chain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        ...candidate,
        status: 'confirmed_duplicate',
        reviewed_by: 'admin-test',
      }),
    }));
    const feedbackInsert = chain({ execute: vi.fn().mockResolvedValue(undefined) });
    mockDb.insertInto.mockReturnValueOnce(feedbackInsert);
    mockDb.selectFrom.mockReturnValueOnce(chain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'dup-1',
        score: '0.91',
        signals_json: { raw_hash_exact: true },
        status: 'confirmed_duplicate',
        reviewed_by: 'admin-test',
        reviewed_at: new Date('2026-07-01T00:00:00Z'),
        created_at: new Date('2026-07-01T00:00:00Z'),
        candidate_case_id: 'case-2',
        candidate_draft_id: 'draft-2',
        candidate_normalized_text: 'mesa igual',
        candidate_final_action: 'draft',
        candidate_draft_status: 'draft',
        candidate_draft_data: { table: { title: 'Mesa igual' } },
      }),
    }));

    const response = await request(makeApp())
      .patch('/admin/discord/duplicate-candidates/dup-1')
      .send({ status: 'confirmed_duplicate' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('confirmed_duplicate');
    expect(response.body.data).toMatchObject({
      match_kind: 'exact',
      candidate_case_id: 'case-2',
      candidate_draft_id: 'draft-2',
      candidate_normalized_text: 'mesa igual',
    });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.insertInto).toHaveBeenCalledWith('discord_parse_feedback');
    expect(feedbackInsert.values).toHaveBeenCalledWith(expect.objectContaining({
      parse_case_id: 'case-1',
      feedback_type: 'duplicate',
      admin_user_id: 'admin-test',
      scope_json: { duplicate_candidate_id: 'dup-1' },
    }));
  });

  it('rejects invalid duplicate decisions', async () => {
    const response = await request(makeApp())
      .patch('/admin/discord/duplicate-candidates/dup-1')
      .send({ status: 'candidate' });

    expect(response.status).toBe(400);
    expect(mockDb.selectFrom).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
