import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../db', () => ({
  db: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    deleteFrom: vi.fn(),
  },
}));

vi.mock('../middleware/auth', () => ({
  requireAdmin: [(req: any, _res: any, next: any) => {
    req.user = { userId: 'admin', role: 'admin' };
    next();
  }],
}));

import adminSettingSuggestionsRoutes from './adminSettingSuggestions';
import { db } from '../db';

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'orderBy', 'returningAll', 'returning', 'set', 'values', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/setting-suggestions', adminSettingSuggestionsRoutes);
  return app;
}

describe('GET /api/v1/admin/setting-suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all suggestions ordered by setting_name', async () => {
    const mockSuggestions = [
      { id: '1', setting_name: 'Fantasia Medieval', suggested_styles: ['épico', 'heróico'] },
      { id: '2', setting_name: 'Steampunk', suggested_styles: ['vitoriano', 'tecnológico'] },
    ];
    const chain = mockChain({ execute: vi.fn().mockResolvedValue(mockSuggestions) });
    (db.selectFrom as Mock).mockReturnValue(chain);

    const res = await request(makeApp()).get('/api/v1/admin/setting-suggestions');
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(2);
  });
});

describe('POST /api/v1/admin/setting-suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new suggestion', async () => {
    const newSuggestion = { id: 'new-1', setting_name: 'Ciberpunk', suggested_styles: ['distópico', 'high-tech'] };
    const returningAllChain = mockChain({ executeTakeFirstOrThrow: vi.fn().mockResolvedValue(newSuggestion) });
    const chain = mockChain({ returningAll: vi.fn().mockReturnValue(returningAllChain) });
    (db.insertInto as Mock).mockReturnValue(chain);

    const res = await request(makeApp())
      .post('/api/v1/admin/setting-suggestions')
      .send({ setting_name: 'Ciberpunk', suggested_styles: ['distópico', 'high-tech'] });
    expect(res.status).toBe(201);
    expect(res.body.suggestion.setting_name).toBe('Ciberpunk');
  });

  it('rejects empty setting_name', async () => {
    const res = await request(makeApp())
      .post('/api/v1/admin/setting-suggestions')
      .send({ setting_name: '', suggested_styles: ['épico'] });
    expect(res.status).toBe(400);
  });

  it('rejects missing suggested_styles', async () => {
    const res = await request(makeApp())
      .post('/api/v1/admin/setting-suggestions')
      .send({ setting_name: 'Fantasia' });
    expect(res.status).toBe(400);
  });

  it('rejects empty suggested_styles array', async () => {
    const res = await request(makeApp())
      .post('/api/v1/admin/setting-suggestions')
      .send({ setting_name: 'Fantasia', suggested_styles: [] });
    expect(res.status).toBe(400);
  });

  it('rejects suggested_styles with no valid strings', async () => {
    const res = await request(makeApp())
      .post('/api/v1/admin/setting-suggestions')
      .send({ setting_name: 'Fantasia', suggested_styles: ['', '  ', null] });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/admin/setting-suggestions/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates an existing suggestion', async () => {
    const updated = { id: 's1', setting_name: 'Fantasia Medieval', suggested_styles: ['heróico'] };
    const returningChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(updated) });
    const updateChain = mockChain({ returningAll: vi.fn().mockReturnValue(returningChain) });
    (db.updateTable as Mock).mockReturnValue(updateChain);

    const res = await request(makeApp())
      .put('/api/v1/admin/setting-suggestions/s1')
      .send({ setting_name: 'Fantasia Medieval', suggested_styles: ['heróico'] });
    expect(res.status).toBe(200);
    expect(res.body.suggestion.setting_name).toBe('Fantasia Medieval');
  });

  it('returns 404 when suggestion not found', async () => {
    const returningChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) });
    const updateChain = mockChain({ returningAll: vi.fn().mockReturnValue(returningChain) });
    (db.updateTable as Mock).mockReturnValue(updateChain);

    const res = await request(makeApp())
      .put('/api/v1/admin/setting-suggestions/nonexistent')
      .send({ setting_name: 'Test', suggested_styles: ['a'] });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/admin/setting-suggestions/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes an existing suggestion', async () => {
    const deleted = { id: 's1', setting_name: 'Fantasia', suggested_styles: ['épico'] };
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(deleted) });
    (db.deleteFrom as Mock).mockReturnValue(chain);

    const res = await request(makeApp()).delete('/api/v1/admin/setting-suggestions/s1');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('removida');
  });

  it('returns 404 when suggestion not found', async () => {
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) });
    (db.deleteFrom as Mock).mockReturnValue(chain);

    const res = await request(makeApp()).delete('/api/v1/admin/setting-suggestions/nonexistent');
    expect(res.status).toBe(404);
  });
});
