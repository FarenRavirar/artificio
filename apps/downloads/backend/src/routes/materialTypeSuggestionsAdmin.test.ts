// Spec 088 (achado de review PR #218, Codex P2) — fila admin de sugestão de
// TIPO: listagem, candidatos, resolve único (merge_existing/create_type/reject)
// sob advisory lock, aprovação registra alias no catálogo central + limpa
// raw_material_type_hint, re-tentativa casa outras pending com o mesmo
// raw_value, 403 pra usuário comum.

import request from 'supertest';
import express from 'express';

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../db', () => ({ db: dbMocks }));

vi.mock('kysely', async () => {
  const actual = await vi.importActual<typeof import('kysely')>('kysely');
  return {
    ...actual,
    sql: Object.assign(
      (..._args: unknown[]) => ({ execute: vi.fn().mockResolvedValue(undefined) }),
      actual.sql,
    ),
  };
});

const loadCatalogMaterialTypesMock = vi.hoisted(() => vi.fn());
const createCatalogMaterialTypeMock = vi.hoisted(() => vi.fn());
const addCatalogMaterialTypeAliasMock = vi.hoisted(() => vi.fn());
const archiveCatalogMaterialTypeMock = vi.hoisted(() => vi.fn());
vi.mock('../services/catalogClient', () => ({
  loadCatalogMaterialTypes: loadCatalogMaterialTypesMock,
  createCatalogMaterialType: createCatalogMaterialTypeMock,
  addCatalogMaterialTypeAlias: addCatalogMaterialTypeAliasMock,
  archiveCatalogMaterialType: archiveCatalogMaterialTypeMock,
}));

let currentUser = { userId: 'admin-1', role: 'admin' as const };
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = currentUser;
    next();
  },
  requireRole: (roles: string | string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(req.user!.role)) {
      res.status(403).json({ error: 'Acesso negado para o seu perfil.' });
      return;
    }
    next();
  },
}));
vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import materialTypeSuggestionsAdminRoutes from './materialTypeSuggestionsAdmin';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/admin/material-type-suggestions', materialTypeSuggestionsAdminRoutes);
  return server;
}

function selectChain(result: unknown, isArrayResult = false) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(isArrayResult ? result : []),
    executeTakeFirst: vi.fn().mockResolvedValue(isArrayResult ? undefined : result),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(result),
  };
}

const SUGGESTION = { id: 's1', material_id: 'material-1', raw_value: 'Classe/Arquétipo', source: 'scraper', suggested_by_user_id: null, status: 'pending' };

const SUPLEMENTO = { id: 'type-suplemento', slug: 'suplemento', name: 'Suplemento', aliases: ['supplement'], status: 'active' as const };

// Mesmo desenho do makeTrx de systemSuggestionsAdmin.test: `relinkPendingSuggestions`
// usa UM update com .returning() (não select-then-update), então suggestionUpdate
// precisa suportar as duas formas de encerrar a cadeia.
function makeTrx(lockedSuggestion: unknown = SUGGESTION) {
  const otherPendingUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue([]) };
  const suggestionUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn(() => otherPendingUpdate), execute: vi.fn().mockResolvedValue(undefined) };
  const materialUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
  const lockSelect = { selectAll: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), executeTakeFirst: vi.fn().mockResolvedValue(lockedSuggestion) };
  const updateTable = vi.fn((table: string) => (table === 'download_material_type_suggestion' ? suggestionUpdate : materialUpdate));
  const selectFrom = vi.fn(() => lockSelect);
  return { updateTable, selectFrom, suggestionUpdate, materialUpdate, otherPendingUpdate, lockSelect };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.updateTable.mockReset();
  dbMocks.transaction.mockReset();
  loadCatalogMaterialTypesMock.mockReset();
  createCatalogMaterialTypeMock.mockReset();
  addCatalogMaterialTypeAliasMock.mockReset();
  archiveCatalogMaterialTypeMock.mockReset();
  currentUser = { userId: 'admin-1', role: 'admin' };

  loadCatalogMaterialTypesMock.mockResolvedValue([SUPLEMENTO]);
  addCatalogMaterialTypeAliasMock.mockResolvedValue(undefined);
  archiveCatalogMaterialTypeMock.mockResolvedValue(undefined);
});

function mockTransaction(trx: ReturnType<typeof makeTrx>) {
  dbMocks.transaction.mockReturnValue({ execute: (fn: (t: unknown) => Promise<unknown>) => fn(trx) });
}

describe('GET /api/v1/admin/material-type-suggestions', () => {
  it('lista a fila e aceita filtro por status', async () => {
    const chain = selectChain([SUGGESTION], true);
    dbMocks.selectFrom.mockReturnValue(chain);

    const response = await request(app()).get('/api/v1/admin/material-type-suggestions?status=pending');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(chain.where).toHaveBeenCalledWith('status', '=', 'pending');
  });

  it('403 para usuário comum — a fila é de triagem admin', async () => {
    currentUser = { userId: 'user-1', role: 'user' as unknown as 'admin' };

    const response = await request(app()).get('/api/v1/admin/material-type-suggestions');

    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/admin/material-type-suggestions/:id/candidates', () => {
  it('devolve tipos ativos que casam por nome, slug ou alias', async () => {
    dbMocks.selectFrom.mockReturnValue(selectChain({ ...SUGGESTION, raw_value: 'Supplement' }));

    const response = await request(app()).get('/api/v1/admin/material-type-suggestions/s1/candidates');

    expect(response.status).toBe(200);
    // Casou pelo ALIAS ('supplement'), não pelo nome — o vocabulário
    // alternativo é exatamente o que a fonte externa costuma publicar.
    expect(response.body.candidates).toHaveLength(1);
    expect(response.body.candidates[0].id).toBe('type-suplemento');
  });

  it('não oferece tipo inativo como candidato', async () => {
    loadCatalogMaterialTypesMock.mockResolvedValue([{ ...SUPLEMENTO, status: 'merged' }]);
    dbMocks.selectFrom.mockReturnValue(selectChain({ ...SUGGESTION, raw_value: 'Suplemento' }));

    const response = await request(app()).get('/api/v1/admin/material-type-suggestions/s1/candidates');

    expect(response.body.candidates).toEqual([]);
  });

  it('404 quando a sugestão não existe', async () => {
    dbMocks.selectFrom.mockReturnValue(selectChain(undefined));

    const response = await request(app()).get('/api/v1/admin/material-type-suggestions/inexistente/candidates');

    expect(response.status).toBe(404);
  });
});

describe('POST /api/v1/admin/material-type-suggestions/:id/resolve', () => {
  it('merge_existing: registra alias no catálogo, grava o tipo no material e limpa raw_material_type_hint', async () => {
    const trx = makeTrx();
    mockTransaction(trx);
    dbMocks.selectFrom.mockReturnValue(selectChain({ material_id: 'material-1' }));

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_material_type_id: 'type-suplemento' });

    expect(response.status).toBe(200);
    expect(response.body.resolved_material_type_id).toBe('type-suplemento');
    // Sem esta escrita o mesmo raw_value voltaria pra fila em todo
    // reprocessamento — aprovar tem que ENSINAR o vocabulário.
    expect(addCatalogMaterialTypeAliasMock).toHaveBeenCalledWith('type-suplemento', 'Classe/Arquétipo');
    expect(trx.materialUpdate.set).toHaveBeenCalledWith(expect.objectContaining({
      material_type: 'Suplemento',
      material_type_id: 'type-suplemento',
      raw_material_type_hint: null,
    }));
  });

  it('merge_existing: 404 quando o tipo alvo não existe no catálogo', async () => {
    mockTransaction(makeTrx());

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_material_type_id: 'inexistente' });

    expect(response.status).toBe(404);
    expect(addCatalogMaterialTypeAliasMock).not.toHaveBeenCalled();
  });

  it('merge_existing: 400 sem target_material_type_id', async () => {
    mockTransaction(makeTrx());

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing' });

    expect(response.status).toBe(400);
  });

  it('create_type: cria o tipo no catálogo já com o raw_value como alias', async () => {
    const created = { id: 'type-novo', slug: 'classe-arquetipo', name: 'Classe/Arquétipo', aliases: ['Classe/Arquétipo'], status: 'active' as const };
    createCatalogMaterialTypeMock.mockResolvedValue(created);
    const trx = makeTrx();
    mockTransaction(trx);
    dbMocks.selectFrom.mockReturnValue(selectChain({ material_id: 'material-1' }));

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'create_type' });

    expect(response.status).toBe(200);
    // Nome default é o próprio raw_value; o alias garante que o mesmo texto
    // bruto case na próxima ingestão sem passar pela fila de novo.
    expect(createCatalogMaterialTypeMock).toHaveBeenCalledWith('Classe/Arquétipo', ['Classe/Arquétipo']);
    expect(trx.materialUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ material_type_id: 'type-novo' }));
  });

  // Achado de review PR #218 (Codex, P2): o POST ao catálogo central persiste
  // em OUTRO serviço, que a transação local não desfaz.
  it('create_type: falha local ARQUIVA o tipo recém-criado, para o retry não colidir de slug', async () => {
    const created = { id: 'type-novo', slug: 'classe-arquetipo', name: 'Classe/Arquétipo', aliases: [], status: 'active' as const };
    createCatalogMaterialTypeMock.mockResolvedValue(created);
    const trx = makeTrx();
    trx.suggestionUpdate.execute.mockRejectedValue(new Error('deadlock detected'));
    mockTransaction(trx);

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'create_type' });

    expect(response.status).toBe(500);
    // Sem a compensação o tipo ficaria órfão no catálogo e todo retry morreria
    // em 500 por colisão de slug UNIQUE, travando a fila para sempre.
    expect(archiveCatalogMaterialTypeMock).toHaveBeenCalledWith('type-novo');
  });

  it('create_type bem-sucedido nunca arquiva nada', async () => {
    createCatalogMaterialTypeMock.mockResolvedValue({ id: 'type-novo', slug: 'c', name: 'C', aliases: [], status: 'active' as const });
    mockTransaction(makeTrx());
    dbMocks.selectFrom.mockReturnValue(selectChain({ material_id: 'material-1' }));

    await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'create_type' });

    expect(archiveCatalogMaterialTypeMock).not.toHaveBeenCalled();
  });

  it('create_type: falha ao arquivar não engole o erro original', async () => {
    createCatalogMaterialTypeMock.mockResolvedValue({ id: 'type-novo', slug: 'c', name: 'C', aliases: [], status: 'active' as const });
    archiveCatalogMaterialTypeMock.mockRejectedValue(new Error('catalog_503'));
    const trx = makeTrx();
    trx.suggestionUpdate.execute.mockRejectedValue(new Error('deadlock detected'));
    mockTransaction(trx);

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'create_type' });

    // A compensação é best-effort: se ela também falhar, o que sobe é a falha
    // real (500), não um erro de limpeza que esconderia a causa.
    expect(response.status).toBe(500);
  });

  it('create_type: aceita nome curado pelo revisor, mantendo o raw_value como alias', async () => {
    createCatalogMaterialTypeMock.mockResolvedValue({ id: 'type-novo', slug: 'classe', name: 'Classe', aliases: [], status: 'active' as const });
    mockTransaction(makeTrx());
    dbMocks.selectFrom.mockReturnValue(selectChain({ material_id: 'material-1' }));

    await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'create_type', name: 'Classe' });

    expect(createCatalogMaterialTypeMock).toHaveBeenCalledWith('Classe', ['Classe/Arquétipo']);
  });

  it('reject: marca rejeitada com o motivo e nunca escreve no catálogo central', async () => {
    const trx = makeTrx();
    mockTransaction(trx);
    dbMocks.selectFrom.mockReturnValue(selectChain({ material_id: 'material-1' }));

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'reject', reason: 'Não é um tipo, é um tema.' });

    expect(response.status).toBe(200);
    expect(trx.suggestionUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected', rejection_reason: 'Não é um tipo, é um tema.' }));
    expect(createCatalogMaterialTypeMock).not.toHaveBeenCalled();
    expect(addCatalogMaterialTypeAliasMock).not.toHaveBeenCalled();
    // Rejeitar NÃO toca no material: ele fica no tipo neutro, que já é o
    // estado correto de "a fonte disse algo que não vira classificação".
    expect(trx.materialUpdate.set).not.toHaveBeenCalled();
  });

  it('re-tentativa: outras pending com o mesmo raw_value são resolvidas no mesmo commit', async () => {
    const trx = makeTrx();
    trx.otherPendingUpdate.execute.mockResolvedValue([{ id: 's2', material_id: 'material-2' }]);
    mockTransaction(trx);
    dbMocks.selectFrom.mockReturnValue(selectChain({ material_id: 'material-1' }));

    await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_material_type_id: 'type-suplemento' });

    // Produtos diferentes da mesma fonte geram o mesmo hint bruto; resolver um
    // sem os outros deixaria a fila cheia de duplicatas já decididas.
    expect(trx.materialUpdate.where).toHaveBeenCalledWith('id', '=', 'material-2');
  });

  it('404 quando a sugestão já foi revisada — o lock não encontra nada pending', async () => {
    mockTransaction(makeTrx(null));

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_material_type_id: 'type-suplemento' });

    expect(response.status).toBe(404);
  });

  it('400 para resolution_type fora do contrato', async () => {
    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      // `create_child` existe na triagem de SISTEMA (árvore), não na de tipo
      // (lista plana) — aceitar aqui gravaria resolution_action que a CHECK
      // constraint da migration_031 rejeita.
      .send({ resolution_type: 'create_child', parent_id: 'x' });

    expect(response.status).toBe(400);
  });

  it('403 para usuário comum — escrita no catálogo central é exclusiva de admin', async () => {
    currentUser = { userId: 'user-1', role: 'user' as unknown as 'admin' };

    const response = await request(app())
      .post('/api/v1/admin/material-type-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_material_type_id: 'type-suplemento' });

    expect(response.status).toBe(403);
  });
});
