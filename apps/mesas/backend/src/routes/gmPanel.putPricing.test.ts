import type { Mock } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { UserRole } from '../db/types.js';

// Achado Codex (PR #283): PUT parcial validava só o payload — `price_type`
// ausente parseava como 'gratuita' (default do schema) e passava, gravando
// estado inválido (ex.: doações numa mesa paga com preço preservado). Fix:
// o handler valida o ESTADO RESULTANTE (linha salva + payload) com
// pricingConsistencySchema antes de gravar. Estes testes cobrem esse gate
// com payloads parciais — não repetem a suíte completa de update.

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

// Linha salva mínima que o PUT busca (admin) — só os campos que o handler lê
// antes da validação efetiva importam aqui.
function savedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'table-1',
    gm_id: 'gm-1',
    system_id: null,
    slug: 'mesa-teste',
    banner_url: null,
    status: 'active',
    price_type: 'paga',
    price_value: 50,
    price_value_monthly: null,
    accepts_donations: false,
    suggested_donation_value: null,
    // Colunas de vagas: o handler valida o ESTADO RESULTANTE das vagas antes
    // de gravar (achado Codex, PR #285), entao a linha salva precisa trazer.
    slots_total: 5,
    slots_filled: 2,
    slots_open: 3,
    ...overrides,
  };
}

async function putWithRow(row: Record<string, unknown>, body: Record<string, unknown>) {
  const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(row) });
  (db.selectFrom as Mock).mockReturnValue(chain);
  return request(makeApp()).put('/api/v1/gm/tables/table-1').send(body);
}

describe('PUT /api/v1/gm/tables/:id — validação do estado resultante de cobrança', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
    mockUserId = 'admin-1';
  });

  it('rejeita doações numa mesa paga (payload parcial válido isolado, inválido contra a linha)', async () => {
    const res = await putWithRow(savedRow(), { accepts_donations: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Doações são exclusivas de mesas gratuitas');
    expect(res.body.field).toBe('accepts_donations');
  });

  it('rejeita transição paga→gratuita sem zerar o price_value salvo', async () => {
    const res = await putWithRow(savedRow(), { price_type: 'gratuita' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Mesa gratuita não pode ter preço — use o valor sugerido de doação');
    expect(res.body.field).toBe('price_value');
  });

  it('rejeita opt-out de doação mantendo valor sugerido salvo', async () => {
    const row = savedRow({
      price_type: 'gratuita',
      price_value: null,
      accepts_donations: true,
      suggested_donation_value: 20,
    });
    const res = await putWithRow(row, { accepts_donations: false });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Valor sugerido exige marcar 'Aceita doações'");
    expect(res.body.field).toBe('suggested_donation_value');
  });

  it('rejeita transição gratuita→paga sem price_value', async () => {
    const row = savedRow({
      price_type: 'gratuita',
      price_value: null,
    });
    const res = await putWithRow(row, { price_type: 'paga' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Valor obrigatório para mesas pagas');
    expect(res.body.field).toBe('price_value');
  });

  it('aceita PUT parcial consistente em mesa paga (estado resultante válido) e grava', async () => {
    (TableRepository.updateTableWithRelations as Mock).mockResolvedValue({
      id: 'table-1',
      slug: 'mesa-teste',
      title: 'Mesa Teste',
      status: 'active',
      updated_at: new Date(),
    });

    const res = await putWithRow(savedRow(), { price_type: 'paga', price_value: 60 });

    expect(res.status).toBe(200);
    expect(TableRepository.updateTableWithRelations).toHaveBeenCalledWith(
      'table-1',
      null,
      expect.objectContaining({ price_type: 'paga', price_value: 60 }),
      undefined,
      undefined,
    );
  });
});

describe('PUT /api/v1/gm/tables/:id — vagas omitidas no PUT parcial (Codex, PR #285)', () => {
  // Sem isto, `mock.calls[0]` traria a chamada do describe anterior.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // O `.partial()` do updateTableSchema NAO remove os `.default()` do
  // baseTableSchema: parse({ title }) materializa slots_total: 4 e
  // slots_filled: 0. Gravar isso rebaixava a mesa aos defaults num PUT que
  // nem mencionou vagas — 94 das 114 mesas em producao seriam corrompidas.
  it('PUT so com titulo NAO grava slots_total/filled/open', async () => {
    (TableRepository.updateTableWithRelations as Mock).mockResolvedValue({
      id: 'table-1',
      slug: 'mesa-teste',
      title: 'Novo titulo',
      status: 'active',
      updated_at: new Date(),
    });

    const res = await putWithRow(savedRow(), { title: 'Novo titulo' });

    expect(res.status).toBe(200);
    const updateData = (TableRepository.updateTableWithRelations as Mock).mock.calls[0][2];
    expect(updateData.slots_total).toBeUndefined();
    expect(updateData.slots_filled).toBeUndefined();
    expect(updateData.slots_open).toBeUndefined();
  });

  it('vagas enviadas de fato continuam sendo gravadas', async () => {
    (TableRepository.updateTableWithRelations as Mock).mockResolvedValue({
      id: 'table-1',
      slug: 'mesa-teste',
      title: 'Mesa Teste',
      status: 'active',
      updated_at: new Date(),
    });

    // Mesa gratuita: com mesa paga, omitir price_type faz o guard de cobranca
    // (PR #283) responder 400 antes de chegar na escrita — comportamento
    // correto, mas mascararia o que este teste quer medir.
    const res = await putWithRow(
      savedRow({ price_type: 'gratuita', price_value: null }),
      { slots_total: 6, slots_open: 2 },
    );

    expect(res.status).toBe(200);
    const updateData = (TableRepository.updateTableWithRelations as Mock).mock.calls[0][2];
    expect(updateData.slots_total).toBe(6);
    expect(updateData.slots_open).toBe(2);
    // slots_filled nao foi enviado: continua preservado.
    expect(updateData.slots_filled).toBeUndefined();
  });
});

describe('PUT /api/v1/gm/tables/:id — slots_filled parcial vs linha salva (Codex, PR #285)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // O refine antigo do updateTableSchema comparava slots_filled com o
  // `.default(4)` materializado pelo `.partial()`, nao com a mesa salva. 64
  // das 114 mesas em producao tem slots_total > 4 e levavam 400 indevido.
  it('aceita slots_filled=5 em mesa com slots_total=5 salvo (era falso 400)', async () => {
    (TableRepository.updateTableWithRelations as Mock).mockResolvedValue({
      id: 'table-1',
      slug: 'mesa-teste',
      title: 'Mesa Teste',
      status: 'active',
      updated_at: new Date(),
    });

    const res = await putWithRow(
      savedRow({ price_type: 'gratuita', price_value: null, slots_total: 5, slots_filled: 2, slots_open: 3 }),
      { slots_filled: 5 },
    );

    expect(res.status).toBe(200);
    const updateData = (TableRepository.updateTableWithRelations as Mock).mock.calls[0][2];
    expect(updateData.slots_filled).toBe(5);
  });

  it('continua rejeitando slots_filled acima do total salvo, com 400 e mensagem', async () => {
    const res = await putWithRow(
      savedRow({ price_type: 'gratuita', price_value: null, slots_total: 3, slots_filled: 1, slots_open: 2 }),
      { slots_filled: 5 },
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Vagas preenchidas não pode ser maior que vagas totais');
    expect(res.body.field).toBe('slots_filled');
    expect(TableRepository.updateTableWithRelations).not.toHaveBeenCalled();
  });

  it('aceita slots_open=5 em mesa com slots_total=6 salvo', async () => {
    (TableRepository.updateTableWithRelations as Mock).mockResolvedValue({
      id: 'table-1',
      slug: 'mesa-teste',
      title: 'Mesa Teste',
      status: 'active',
      updated_at: new Date(),
    });

    const res = await putWithRow(
      savedRow({ price_type: 'gratuita', price_value: null, slots_total: 6, slots_filled: 1, slots_open: 5 }),
      { slots_open: 5 },
    );

    expect(res.status).toBe(200);
  });
});
