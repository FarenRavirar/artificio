import type { Mock } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { UserRole } from '../db/types.js';

// T5.11 (spec 079): cobertura do loop de aprendizado do pré-preenchimento
// público — POST /gm/parse-preview (T5.3) grava discord_parse_cases com
// final_action='draft', e POST /gm/tables (T5.6, recordPublishedParseCase)
// fecha o loop com UPDATE final_action='synced' quando a mesa publicada
// carrega o parse_case_id do preview. Este teste nunca existiu até agora —
// achado durante auditoria de "tudo da spec implementado?" (o código do loop
// existia, mas sem teste algum cobrindo o fluxo ponta a ponta).

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
  },
}));
vi.mock('../services/tableService', () => ({
  TableService: {
    isDdalEligibleSystem: vi.fn().mockResolvedValue(true),
    validateVttPlatform: vi.fn().mockResolvedValue(null),
    validateCommunicationPlatform: vi.fn().mockResolvedValue({ id: null, legacy: null }),
    generateSlug: vi.fn().mockReturnValue('mesa-teste'),
    prepareTableData: vi.fn().mockImplementation((data) => ({ ...data, id: 'table-new-1' })),
  },
}));
vi.mock('../services/systemCatalogProvider', () => ({
  systemExistsInCatalog: vi.fn().mockResolvedValue(true),
  hydrateTableSystemFields: vi.fn().mockImplementation((tables) => Promise.resolve(tables)),
}));
vi.mock('../services/benchmarkService', () => ({ BenchmarkService: {} }));
vi.mock('../services/activityLogger', () => ({ logActivity: vi.fn() }));
vi.mock('../services/adminNotifications', () => ({ notifyAdmins: vi.fn() }));
vi.mock('../services/actorNameResolver', () => ({ resolveActorName: vi.fn().mockResolvedValue('Mestre Teste') }));
vi.mock('../services/metaScrapeClient', () => ({
  triggerMetaScrape: vi.fn(),
  triggerMetaScrapeOnPublish: vi.fn(),
}));
vi.mock('../discord/shared', () => ({
  loadSystemsForParser: vi.fn().mockResolvedValue([]),
}));

const mockParseTextForPreview = vi.fn();
vi.mock('../discord/parseTextForPreview', () => ({
  parseTextForPreview: (...args: unknown[]) => mockParseTextForPreview(...args),
}));

let mockRole: UserRole = 'gm';
let mockUserId = 'gm-user-1';
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: mockUserId, role: mockRole };
    next();
  },
}));

import gmPanelRoutes from './gmPanel.js';
import { db } from '../db/index.js';
import { TableRepository } from '../repositories/tableRepository.js';

function mockSelectChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'returning', 'executeTakeFirst'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) chain[m] = vi.fn().mockReturnThis();
  return Object.assign(chain, overrides);
}

function mockUpdateChain(overrides: Record<string, Mock> = {}) {
  const methods = ['set', 'where', 'returning', 'execute', 'executeTakeFirst'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) chain[m] = vi.fn().mockReturnThis();
  return Object.assign(chain, overrides);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/gm', gmPanelRoutes);
  return app;
}

const PARSE_CASE_ID = '006bd8d3-1573-4e56-a375-fd1c37e11bd6';

describe('POST /api/v1/gm/parse-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'gm';
    mockUserId = 'gm-user-1';
  });

  it('exige gm_profiles — 403 sem perfil de mestre (achado de review, CodeRabbit PR #172)', async () => {
    (db.selectFrom as Mock).mockReturnValue(mockSelectChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) }));

    const res = await request(makeApp())
      .post('/api/v1/gm/parse-preview')
      .send({ text: 'Título: Mesa de Teste\nSistema: D&D 5e\nVagas: 4' });

    expect(res.status).toBe(403);
    expect(mockParseTextForPreview).not.toHaveBeenCalled();
  });

  it('retorna parse_case_id + table quando o parser reconhece o anúncio', async () => {
    (db.selectFrom as Mock).mockReturnValue(mockSelectChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) }));
    mockParseTextForPreview.mockResolvedValue({
      parseCaseId: PARSE_CASE_ID,
      table: { title: 'Mesa de Teste', system_id: null, actual_gm_name: 'Fulano' },
      contacts: [],
      schedules: [],
    });

    const res = await request(makeApp())
      .post('/api/v1/gm/parse-preview')
      .send({ text: 'Título: Mesa de Teste\nMestre: Fulano\nSistema: D&D 5e\nVagas: 4' });

    expect(res.status).toBe(200);
    expect(res.body.data.parse_case_id).toBe(PARSE_CASE_ID);
    expect(res.body.data.table.title).toBe('Mesa de Teste');
  });

  it('devolve table: null (200, não erro) quando o parser não reconhece o texto como anúncio', async () => {
    (db.selectFrom as Mock).mockReturnValue(mockSelectChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) }));
    mockParseTextForPreview.mockResolvedValue({ parseCaseId: null, table: null, contacts: [], schedules: [] });

    const res = await request(makeApp())
      .post('/api/v1/gm/parse-preview')
      .send({ text: 'isso não é um anúncio de mesa, só um texto qualquer' });

    expect(res.status).toBe(200);
    expect(res.body.data.table).toBeNull();
  });

  it('400 em payload inválido (texto vazio)', async () => {
    const res = await request(makeApp()).post('/api/v1/gm/parse-preview').send({ text: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/gm/tables — fecha loop de aprendizado (T5.6/T5.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'gm';
    mockUserId = 'gm-user-1';
  });

  const VALID_TABLE_PAYLOAD = {
    title: 'Mesa Publicada',
    description: 'Descrição da mesa',
    type: 'campanha',
    modality: 'online',
    price_type: 'gratuita',
    slots_total: 4,
    slots_open: 4,
    language: 'pt-BR',
    system_id: 'ce7888fe-211f-4236-b59c-c60877d66336',
    scenario_id: null,
    schedules: [],
    contacts: [{ channel: 'whatsapp', value: '5511999999999', label: 'WhatsApp' }],
    publisher_role: 'gm',
    actual_gm_name: null,
    rules_notes: '',
    is_covil: false,
    is_ddal: false,
  };

  it('com parse_case_id: faz UPDATE final_action=synced correlacionado ao case ainda em draft', async () => {
    const selectChain = mockSelectChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) });
    (db.selectFrom as Mock).mockReturnValue(selectChain);

    const executeTakeFirst = vi.fn().mockResolvedValue({ numUpdatedRows: BigInt(1) });
    const updateChain = mockUpdateChain({ executeTakeFirst });
    (db.updateTable as Mock).mockReturnValue(updateChain);

    (TableRepository.createTableWithRelations as Mock).mockResolvedValue({
      id: 'table-new-1', slug: 'mesa-publicada', title: 'Mesa Publicada', status: 'draft',
    });

    const res = await request(makeApp())
      .post('/api/v1/gm/tables')
      .send({ ...VALID_TABLE_PAYLOAD, parse_case_id: PARSE_CASE_ID });

    expect(res.status).toBe(201);
    // recordPublishedParseCase roda fire-and-forget (void, não é aguardado
    // pela resposta) — dá um tick pro microtask pendente resolver antes de
    // checar as chamadas do mock, senão a asserção corre uma race.
    await new Promise((resolve) => setImmediate(resolve));

    expect(db.updateTable).toHaveBeenCalledWith('discord_parse_cases');
    expect(updateChain.where).toHaveBeenCalledWith('id', '=', PARSE_CASE_ID);
    expect(updateChain.where).toHaveBeenCalledWith('final_action', '=', 'draft');
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ final_action: 'synced' }),
    );
  });

  it('sem parse_case_id: publica normalmente, nunca toca discord_parse_cases', async () => {
    const selectChain = mockSelectChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) });
    (db.selectFrom as Mock).mockReturnValue(selectChain);
    (TableRepository.createTableWithRelations as Mock).mockResolvedValue({
      id: 'table-new-2', slug: 'mesa-manual', title: 'Mesa Manual', status: 'draft',
    });

    const res = await request(makeApp())
      .post('/api/v1/gm/tables')
      .send(VALID_TABLE_PAYLOAD);

    expect(res.status).toBe(201);
    await new Promise((resolve) => setImmediate(resolve));

    expect(db.updateTable).not.toHaveBeenCalled();
  });

  it('achado de review (CodeRabbit, PR #172): parse_case_id de case já synced por outro mestre não é sobrescrito — correlação exige final_action=draft', async () => {
    const selectChain = mockSelectChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) });
    (db.selectFrom as Mock).mockReturnValue(selectChain);

    // Simula 0 linhas afetadas — é o comportamento real do WHERE
    // final_action='draft' quando o case já foi fechado por outra publicação.
    const executeTakeFirst = vi.fn().mockResolvedValue({ numUpdatedRows: BigInt(0) });
    const updateChain = mockUpdateChain({ executeTakeFirst });
    (db.updateTable as Mock).mockReturnValue(updateChain);

    (TableRepository.createTableWithRelations as Mock).mockResolvedValue({
      id: 'table-new-3', slug: 'mesa-3', title: 'Mesa 3', status: 'draft',
    });

    const res = await request(makeApp())
      .post('/api/v1/gm/tables')
      .send({ ...VALID_TABLE_PAYLOAD, parse_case_id: PARSE_CASE_ID });

    // Publicação da mesa não é bloqueada — best-effort, só o correlacionamento falha silenciosamente (com warn).
    expect(res.status).toBe(201);
    await new Promise((resolve) => setImmediate(resolve));

    expect(updateChain.where).toHaveBeenCalledWith('final_action', '=', 'draft');
  });

  it('falha no UPDATE de discord_parse_cases não derruba a criação da mesa (best-effort)', async () => {
    const selectChain = mockSelectChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) });
    (db.selectFrom as Mock).mockReturnValue(selectChain);

    const updateChain = mockUpdateChain({ executeTakeFirst: vi.fn().mockRejectedValue(new Error('db down')) });
    (db.updateTable as Mock).mockReturnValue(updateChain);

    (TableRepository.createTableWithRelations as Mock).mockResolvedValue({
      id: 'table-new-4', slug: 'mesa-4', title: 'Mesa 4', status: 'draft',
    });

    const res = await request(makeApp())
      .post('/api/v1/gm/tables')
      .send({ ...VALID_TABLE_PAYLOAD, parse_case_id: PARSE_CASE_ID });

    expect(res.status).toBe(201);
  });
});
