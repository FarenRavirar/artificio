import type { Mock } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { UserRole } from '../db/types.js';

// Achado do mantenedor 2026-07-08: mesa via Discord sync (spec 060) nasce
// gm_id: null — GET/PUT /api/v1/gm/tables/:id sempre 404 nela, pq os dois
// filtravam por gm_id do GM logado. Fix: userRole==='admin' pula o filtro.
// Este teste cobre só esse bypass — não repete a suíte completa de update.

vi.mock('../db', () => ({
  db: {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock('../repositories/tableRepository', () => ({
  TableRepository: {
    createTableWithRelations: vi.fn(),
    findById: vi.fn(),
    findByIdAndGm: vi.fn(),
    findContactsByTableId: vi.fn().mockResolvedValue([]),
    findSchedulesByTableId: vi.fn().mockResolvedValue([]),
    updateTableWithRelations: vi.fn(),
  },
}));
vi.mock('../services/tableService', () => ({
  TableService: {
    isDdalEligibleSystem: vi.fn().mockResolvedValue(true),
    validateVttPlatform: vi.fn().mockResolvedValue(null),
    validateCommunicationPlatform: vi.fn().mockResolvedValue({ id: null, legacy: null }),
  },
}));
vi.mock('../services/benchmarkService', () => ({ BenchmarkService: {} }));
vi.mock('../services/activityLogger', () => ({ logActivity: vi.fn() }));
vi.mock('../services/adminNotifications', () => ({ notifyAdmins: vi.fn() }));
vi.mock('../services/actorNameResolver', () => ({ resolveActorName: vi.fn().mockResolvedValue('Admin Teste') }));

let mockRole: UserRole = 'admin';
let mockUserId = 'admin-1';
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: mockUserId, role: mockRole };
    next();
  },
}));

import gmPanelRoutes from './gmPanel.js';
import { db } from '../db/index.js';
import { TableRepository } from '../repositories/tableRepository.js';

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'returning', 'set', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow'];
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

const ORPHAN_TABLE = {
  id: 'table-orphan',
  gm_id: null,
  system_id: null,
  slug: 'mesa-orfa',
  title: 'Mesa Órfã',
  status: 'draft',
  description: '**segura** <script>alert(1)</script>',
  synopsis_narrative: '<b>narrativa</b>',
  benefits_text: '<img src=x onerror=alert(2)>benefícios',
  table_gm_bio: '<script>alert(3)</script>bio',
  banner_url: 'https://cdn.discordapp.com/attachments/1/2/banner.png?ex=expired',
  updated_at: new Date(),
};

describe('GET /api/v1/gm/tables/:id — mesa órfã (gm_id: null)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
    mockUserId = 'admin-1';
  });

  it('admin carrega mesa órfã sem exigir gm_id', async () => {
    (TableRepository.findById as Mock).mockResolvedValue(ORPHAN_TABLE);

    const res = await request(makeApp()).get('/api/v1/gm/tables/table-orphan');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('table-orphan');
    expect(res.body.data.banner_url).toBeNull();
    expect(res.body.data.description).toBe('**segura** ');
    expect(res.body.data.synopsis_narrative).toBe('narrativa');
    expect(res.body.data.benefits_text).toBe('benefícios');
    expect(res.body.data.table_gm_bio).toBe('bio');
    expect(TableRepository.findById).toHaveBeenCalledWith('table-orphan');
    expect(TableRepository.findByIdAndGm).not.toHaveBeenCalled();
  });

  it('GM comum continua 404 em mesa que não é dele (findByIdAndGm)', async () => {
    mockRole = 'gm';
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) });
    (db.selectFrom as Mock).mockReturnValue(chain);
    (TableRepository.findByIdAndGm as Mock).mockResolvedValue(null);

    const res = await request(makeApp()).get('/api/v1/gm/tables/table-orphan');

    expect(res.status).toBe(404);
    expect(TableRepository.findByIdAndGm).toHaveBeenCalledWith('table-orphan', 'gm-profile-1');
    expect(TableRepository.findById).not.toHaveBeenCalled();
  });
});

describe('PUT /api/v1/gm/tables/:id — mesa órfã (gm_id: null)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
    mockUserId = 'admin-1';
  });

  it('admin edita mesa órfã — updateTableWithRelations chamado com gmProfileId null', async () => {
    (db.selectFrom as Mock).mockReturnValue(mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(ORPHAN_TABLE) }));
    (TableRepository.updateTableWithRelations as Mock).mockResolvedValue({ id: 'table-orphan', slug: 'mesa-orfa', title: 'Mesa Órfã Editada', status: 'draft', updated_at: new Date() });

    const res = await request(makeApp())
      .put('/api/v1/gm/tables/table-orphan')
      .send({ title: 'Mesa Órfã Editada' });

    expect(res.status).toBe(200);
    expect(TableRepository.updateTableWithRelations).toHaveBeenCalledWith(
      'table-orphan',
      null,
      expect.objectContaining({ title: 'Mesa Órfã Editada' }),
      undefined,
      undefined,
    );
  });

  it('GM comum sem perfil recebe 403 (não bate a checagem de gm_profiles)', async () => {
    mockRole = 'gm';
    (db.selectFrom as Mock).mockReturnValue(mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(null) }));

    const res = await request(makeApp())
      .put('/api/v1/gm/tables/table-orphan')
      .send({ title: 'Tentativa Indevida' });

    expect(res.status).toBe(403);
    expect(TableRepository.updateTableWithRelations).not.toHaveBeenCalled();
  });
});

const unsafeContactCases = [
  ['javascript:', { channel: 'discord', value: 'mestre', discord_server_url: 'javascript:alert(1)' }],
  ['data:', { channel: 'discord', value: 'mestre', discord_server_url: 'data:text/html,x' }],
  ['vbscript:', { channel: 'discord', value: 'mestre', discord_server_url: 'vbscript:msgbox(1)' }],
  ['http:', { channel: 'form', value: 'http://forms.gle/abc' }],
  ['host Discord falso', { channel: 'discord', value: 'mestre', discord_server_url: 'https://example.com/convite' }],
] as const;

describe('rotas manuais — contatos inseguros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'gm';
    mockUserId = 'gm-1';
  });

  it.each(unsafeContactCases)('POST /gm/tables rejeita %s', async (_label, contact) => {
    const res = await request(makeApp()).post('/api/v1/gm/tables').send({
      title: 'Mesa segura',
      system_id: '123e4567-e89b-42d3-a456-426614174000',
      type: 'campanha',
      modality: 'online',
      contacts: [contact],
    });

    expect(res.status).toBe(400);
  });

  it.each(unsafeContactCases)('PUT /gm/tables/:id rejeita %s', async (_label, contact) => {
    const res = await request(makeApp())
      .put('/api/v1/gm/tables/table-1')
      .send({ contacts: [contact] });

    expect(res.status).toBe(400);
  });

  it('mensagem de http explícito aponta https', async () => {
    const res = await request(makeApp())
      .put('/api/v1/gm/tables/table-1')
      .send({ contacts: [{ channel: 'form', value: 'http://forms.gle/abc' }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('https://');
  });
});

describe('PUT /gm/profile — contactMethodsSchema unificado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'gm';
    mockUserId = 'gm-1';
  });

  it.each(unsafeContactCases)('rejeita payload inteiro para %s', async (_label, contact) => {
    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ contact_methods: [contact] });

    expect(res.status).toBe(400);
    expect(db.updateTable).not.toHaveBeenCalled();
  });

  it('JSON-string inválido retorna 400', async () => {
    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ contact_methods: '[invalido' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('JSON válido');
  });

  it('JSON-string válido passa pelo schema e canonicaliza URL sem esquema', async () => {
    const selectChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'profile-1' }) });
    const updateChain = mockChain({
      execute: vi.fn().mockResolvedValue([{
        id: 'profile-1',
        bio_long: null,
        closed_group_description: null,
      }]),
    });
    (db.selectFrom as Mock).mockReturnValue(selectChain);
    (db.updateTable as Mock).mockReturnValue(updateChain);

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ contact_methods: JSON.stringify([{ channel: 'form', value: 'forms.gle/abc' }]) });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      contact_methods: JSON.stringify([{
        channel: 'form',
        value: 'https://forms.gle/abc',
        label: null,
        discord_server_url: null,
      }]),
    }));
  });
});
