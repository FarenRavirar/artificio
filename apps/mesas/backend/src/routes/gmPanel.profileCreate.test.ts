import type { Mock } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { UserRole } from '../db/types.js';

// T4.0p2 (spec 096, R12): criar o perfil de mestre DENTRO do editor — POST
// /gm/profile passa a aceitar contact_methods com o MESMO schema do PUT.
// Antes, criar com contatos exigia duas escritas (POST + PUT), e a falha da
// segunda deixava o perfil pela metade. Agora é uma escrita só.
vi.mock('../db/index.js', () => ({
  db: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    transaction: vi.fn(),
  },
}));

let mockUserId = 'gm-user-1';
let mockRole: UserRole = 'gm';
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: mockUserId, role: mockRole };
    next();
  },
}));

import gmPanelRoutes from './gmPanel.js';
import { db } from '../db/index.js';

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'where', 'executeTakeFirst', 'values', 'returning', 'execute', 'set'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/gm', gmPanelRoutes);
  return app;
}

const PROFILE_ROW = {
  id: 'profile-1',
  slug: 'mestre-teste',
  nickname: 'Mestre Teste',
  bio_long: null,
  closed_group_description: null,
  contact_methods: [{ channel: 'form', value: 'https://forms.gle/abc', label: null, discord_server_url: null }],
};

function mockInsertChain(row: unknown = PROFILE_ROW) {
  return mockChain({ execute: vi.fn().mockResolvedValue([row]) });
}

describe('POST /api/v1/gm/profile — cria perfil COM contact_methods (T4.0p2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = 'gm-user-1';
    mockRole = 'gm';
  });

  it('cria perfil com contact_methods numa chamada só, canonicalizado e serializado', async () => {
    const selectChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) });
    const insertChain = mockInsertChain();
    const usersChain = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    (db.selectFrom as Mock).mockReturnValue(selectChain);
    (db.insertInto as Mock).mockReturnValue(insertChain);
    (db.updateTable as Mock).mockReturnValue(usersChain);

    const res = await request(makeApp())
      .post('/api/v1/gm/profile')
      .send({
        slug: 'mestre-teste',
        nickname: 'Mestre Teste',
        contact_methods: [{ channel: 'form', value: 'forms.gle/abc' }],
      });

    expect(res.status).toBe(201);
    // O POST grava os contatos no MESMO insert do perfil — não há segunda
    // escrita nem estado pela metade.
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      contact_methods: JSON.stringify([{
        channel: 'form',
        value: 'https://forms.gle/abc',
        label: null,
        discord_server_url: null,
      }]),
    }));
    expect(db.updateTable).toHaveBeenCalledTimes(1); // só o update de role no users
    expect(res.body.data.contact_methods).toEqual([
      { channel: 'form', value: 'https://forms.gle/abc', label: null, discord_server_url: null },
    ]);
  });

  it('aceita contact_methods como JSON-string, igual ao PUT (compatibilidade de transporte)', async () => {
    (db.selectFrom as Mock).mockReturnValue(mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) }));
    const insertChain = mockInsertChain();
    (db.insertInto as Mock).mockReturnValue(insertChain);
    (db.updateTable as Mock).mockReturnValue(mockChain({ execute: vi.fn().mockResolvedValue([]) }));

    const res = await request(makeApp())
      .post('/api/v1/gm/profile')
      .send({
        slug: 'mestre-teste',
        nickname: 'Mestre Teste',
        contact_methods: JSON.stringify([{ channel: 'discord', value: 'mestre' }]),
      });

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      contact_methods: JSON.stringify([{
        channel: 'discord',
        value: 'mestre',
        label: null,
        discord_server_url: null,
      }]),
    }));
  });

  it('sem contact_methods grava undefined — o DEFAULT [] da coluna se aplica', async () => {
    (db.selectFrom as Mock).mockReturnValue(mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) }));
    const insertChain = mockInsertChain({ ...PROFILE_ROW, contact_methods: [] });
    (db.insertInto as Mock).mockReturnValue(insertChain);
    (db.updateTable as Mock).mockReturnValue(mockChain({ execute: vi.fn().mockResolvedValue([]) }));

    const res = await request(makeApp())
      .post('/api/v1/gm/profile')
      .send({ slug: 'mestre-teste', nickname: 'Mestre Teste' });

    expect(res.status).toBe(201);
    const values = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values.contact_methods).toBeUndefined();
  });

  it('canal fora dos 7 rejeita a operação inteira sem inserir nada', async () => {
    const res = await request(makeApp())
      .post('/api/v1/gm/profile')
      .send({
        slug: 'mestre-teste',
        nickname: 'Mestre Teste',
        contact_methods: [{ channel: 'telegram', value: 'mestre' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.field).toBe('contact_methods.0.channel');
    expect(db.insertInto).not.toHaveBeenCalled();
  });

  it('JSON-string inválido devolve 400 antes de qualquer escrita', async () => {
    const res = await request(makeApp())
      .post('/api/v1/gm/profile')
      .send({ slug: 'mestre-teste', nickname: 'Mestre Teste', contact_methods: '[invalido' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('JSON válido');
    expect(db.insertInto).not.toHaveBeenCalled();
  });
});
