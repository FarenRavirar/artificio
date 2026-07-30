// T4.11 (spec 086, Fase 4) — fila admin, candidatos pontuados, resolve único
// (merge_existing/create_alias/create_child/create_system/reject) sob
// advisory lock, aprovação registra alias + limpa raw_system_hint,
// re-tentativa (T4.6) casa outras sugestões pending com o mesmo raw_value,
// notificação só para source=user, 403 pra usuário comum.

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

const loadCatalogSystemsFlatMock = vi.hoisted(() => vi.fn());
const createCatalogNodeMock = vi.hoisted(() => vi.fn());
const addCatalogNodeAliasMock = vi.hoisted(() => vi.fn());
// resolveTaxonomyIds é lógica pura (sem I/O) — usa a implementação real via
// importActual em vez de mockar, evita duplicar a regra no teste.
vi.mock('../services/catalogClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/catalogClient')>();
  return {
    resolveTaxonomyIds: actual.resolveTaxonomyIds,
    loadCatalogSystemsFlat: loadCatalogSystemsFlatMock,
    createCatalogNode: createCatalogNodeMock,
    addCatalogNodeAlias: addCatalogNodeAliasMock,
  };
});

const emitNotificationMock = vi.hoisted(() => vi.fn());
vi.mock('../services/notify', () => ({ emitNotification: emitNotificationMock }));

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

import systemSuggestionsAdminRoutes from './systemSuggestionsAdmin';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/admin/system-suggestions', systemSuggestionsAdminRoutes);
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

const SUGGESTION = { id: 's1', material_id: 'material-1', raw_value: 'D&D 5e', source: 'user', suggested_by_user_id: 'user-1', status: 'pending' };

// JS default param só ativa quando o argumento é `undefined` — chamar
// makeTrx(undefined) explicitamente cai no default SUGGESTION, não no que
// se quer testar. Usar makeTrx(null) pro caso "lock não achou nada".
// Achado real (review PR #204, Codex, P2): relinkPendingSuggestions passou a
// usar UM update com .returning() (não select-then-update) — suggestionUpdate
// precisa suportar .returning().execute() (T4.6) além de .execute() (approve
// da própria sugestão). otherPendingUpdate simula o resultado desse update
// único: por default vazio (nenhuma outra sugestão pending casada).
function makeTrx(lockedSuggestion: unknown = SUGGESTION) {
  const otherPendingUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue([]) };
  const suggestionUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn(() => otherPendingUpdate), execute: vi.fn().mockResolvedValue(undefined) };
  const materialUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
  const lockSelect = { selectAll: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), executeTakeFirst: vi.fn().mockResolvedValue(lockedSuggestion) };
  const updateTable = vi.fn((table: string) => (table === 'download_system_suggestion' ? suggestionUpdate : materialUpdate));
  const selectFrom = vi.fn(() => lockSelect);
  return { updateTable, selectFrom, suggestionUpdate, materialUpdate, otherPendingUpdate, lockSelect };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.updateTable.mockReset();
  dbMocks.transaction.mockReset();
  loadCatalogSystemsFlatMock.mockReset();
  createCatalogNodeMock.mockReset();
  addCatalogNodeAliasMock.mockReset();
  emitNotificationMock.mockReset();
  currentUser = { userId: 'admin-1', role: 'admin' };

  dbMocks.updateTable.mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) });
  // Default: catálogo vazio — resolveTaxonomyIds cai no fallback (systemId =
  // matchedId, editionId = null) quando o node não está no snapshot mockado.
  // Testes que precisam de hierarquia real (raiz/edição) sobrescrevem.
  loadCatalogSystemsFlatMock.mockResolvedValue([]);
});

describe('GET /api/v1/admin/system-suggestions', () => {
  it('lista a fila, filtrando por status quando informado', async () => {
    const chain = selectChain([{ id: 's1', status: 'pending' }], true);
    dbMocks.selectFrom.mockReturnValueOnce(chain);

    const res = await request(app()).get('/api/v1/admin/system-suggestions?status=pending');

    expect(res.status).toBe(200);
    expect(chain.where).toHaveBeenCalledWith('status', '=', 'pending');
  });

  it('403 pra usuário comum', async () => {
    currentUser = { userId: 'user-1', role: 'user' as unknown as 'admin' };
    const res = await request(app()).get('/api/v1/admin/system-suggestions');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/system-suggestions/:id/candidates', () => {
  it('devolve candidatos pontuados com recommended_action', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain(SUGGESTION));
    loadCatalogSystemsFlatMock.mockResolvedValue([
      { id: 'dd', name: 'Dungeons & Dragons', name_pt: null, slug: 'dnd', path_slug: 'dnd', node_type: 'system', parent_id: null, aliases: ['D&D'] },
    ]);

    const res = await request(app()).get('/api/v1/admin/system-suggestions/s1/candidates');

    expect(res.status).toBe(200);
    expect(res.body.recommended_action).toBeDefined();
    expect(Array.isArray(res.body.candidates)).toBe(true);
  });

  it('404 quando sugestão não existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain(undefined));
    const res = await request(app()).get('/api/v1/admin/system-suggestions/inexistente/candidates');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/admin/system-suggestions/:id/resolve', () => {
  it('merge_existing: registra alias, grava system_id no material, limpa raw_system_hint, notifica source=user', async () => {
    const trx = makeTrx();
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'user', suggested_by_user_id: 'user-1' }));

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_node_id: 'dd5e' });

    expect(res.status).toBe(200);
    expect(addCatalogNodeAliasMock).toHaveBeenCalledWith('dd5e', 'D&D 5e');
    expect(trx.materialUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ system_id: 'dd5e', raw_system_hint: null }));
    expect(emitNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', kind: 'system_suggestion_resolved' }),
      expect.anything(),
    );
  });

  // Achado real (review PR #218, CodeRabbit): a rota passava `req.body` cru
  // aos resolvers, então a normalização do schema não alcançava o valor
  // efetivamente usado. Mesmo defeito da rota de tipo.
  //
  it('normaliza o valor que chega ao catálogo central', async () => {
    const trx = makeTrx();
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (t: unknown) => Promise<unknown>) => cb(trx) });
    createCatalogNodeMock.mockResolvedValue({ id: 'novo-node' });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'scraper', suggested_by_user_id: null }));

    await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_system', name: '   Tormenta   ' });

    expect(createCatalogNodeMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tormenta' }));
  });

  it('rejeita name acima do limite em vez de repassá-lo ao catálogo', async () => {
    const response = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_system', name: 'x'.repeat(201) });

    expect(response.status).toBe(400);
    expect(createCatalogNodeMock).not.toHaveBeenCalled();
  });

  // O CodeRabbit (2ª passada) pediu um seam que FALHE se a rota voltar a passar
  // `req.body`. Ele NÃO existe hoje sem mudar código de produção, e isso foi
  // medido, não suposto: revertendo a linha para `req.body` e rodando a suíte,
  // 23/23 continuavam passando.
  //
  // A razão é estrutural: todo campo string de `resolveBodySchema` tem
  // `.trim()`, e `readTrimmed` dentro de cada resolver apara de novo — os dois
  // caminhos convergem para o MESMO valor em todos os campos. `node_type`
  // (enum, sem trim) também não discrimina: `safeParse` rejeita ' edition '
  // com 400 antes de o corpo chegar a qualquer resolver, então o 400 aparece
  // nos dois casos.
  //
  // Consequência prática: `parsed.data` aqui é defesa em profundidade, não
  // correção de bug observável — a normalização já acontecia por acidente do
  // `readTrimmed`. O valor da mudança é o contrato (a rota entrega dado
  // validado, e resolver novo não precisa lembrar de aparar). Deixar isso
  // explícito evita que alguém "simplifique" de volta achando que é redundante.
  //
  // Um seam de verdade exigiria remover `readTrimmed` dos resolvers, passando a
  // confiar só no schema. Não foi feito nesta PR por ser refactor amplo em
  // rota de produção, fora do que o achado pedia.
  it('normaliza reason ao rejeitar (cobre o caminho, não distingue a origem do body)', async () => {
    const trx = makeTrx();
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (t: unknown) => Promise<unknown>) => cb(trx) });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'scraper', suggested_by_user_id: null }));

    await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'reject', reason: '  Fora do escopo  ' });

    expect(trx.suggestionUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected', rejection_reason: 'Fora do escopo' }),
    );
  });

  it('create_system: cria node novo com o raw_value como alias, nunca chama addCatalogNodeAlias', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper', suggested_by_user_id: null, raw_value: 'Sistema Novo XYZ' });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    createCatalogNodeMock.mockResolvedValue({ id: 'novo-node' });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'Sistema Novo XYZ', source: 'scraper', suggested_by_user_id: null }));

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_system', name: 'Sistema Novo XYZ' });

    expect(res.status).toBe(200);
    expect(createCatalogNodeMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sistema Novo XYZ', node_type: 'system', aliases: ['Sistema Novo XYZ'] }));
    expect(addCatalogNodeAliasMock).not.toHaveBeenCalled();
    expect(emitNotificationMock).not.toHaveBeenCalled();
  });

  it('create_system com edition_name: cria sistema + edição na mesma chamada (equivalente ao create_chain do mesas)', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper', suggested_by_user_id: null });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    createCatalogNodeMock.mockResolvedValueOnce({ id: 'sistema-novo' }).mockResolvedValueOnce({ id: 'edicao-nova' });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'scraper', suggested_by_user_id: null }));

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_system', name: 'Dungeons & Dragons', edition_name: '5e' });

    expect(res.status).toBe(200);
    expect(createCatalogNodeMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Dungeons & Dragons', node_type: 'system' }));
    expect(createCatalogNodeMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: '5e', node_type: 'edition', parent_id: 'sistema-novo' }));
    expect(trx.materialUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ system_id: 'edicao-nova' }));
  });

  it('create_alias: registra alias, grava system_id no material, nunca notifica scraper', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper', suggested_by_user_id: null });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'scraper', suggested_by_user_id: null }));

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_alias', target_node_id: 'dd5e' });

    expect(res.status).toBe(200);
    expect(addCatalogNodeAliasMock).toHaveBeenCalledWith('dd5e', 'D&D 5e');
    expect(trx.materialUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ system_id: 'dd5e' }));
    expect(emitNotificationMock).not.toHaveBeenCalled();
  });

  it('400 quando create_alias sem target_node_id', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper' });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_alias' });

    expect(res.status).toBe(400);
  });

  it('create_child: cria node sob parent existente com raw_value como alias', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper', suggested_by_user_id: null });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    loadCatalogSystemsFlatMock.mockResolvedValue([
      { id: 'dd', name: 'Dungeons & Dragons', name_pt: null, slug: 'dnd', path_slug: 'dnd', node_type: 'system', parent_id: null, aliases: [] },
      { id: 'edicao-nova', name: '5e', name_pt: null, slug: '5e', path_slug: 'dnd/5e', node_type: 'edition', parent_id: 'dd', aliases: [] },
    ]);
    createCatalogNodeMock.mockResolvedValue({ id: 'edicao-nova' });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'scraper', suggested_by_user_id: null }));

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_child', parent_id: 'dd', node_type: 'edition', name: '5e' });

    expect(res.status).toBe(200);
    expect(createCatalogNodeMock).toHaveBeenCalledWith(expect.objectContaining({ name: '5e', node_type: 'edition', parent_id: 'dd', aliases: ['D&D 5e'] }));
    expect(trx.materialUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ system_id: 'dd', edition_id: 'edicao-nova' }));
  });

  it('400 quando create_child sem parent_id', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper' });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_child', node_type: 'edition' });

    expect(res.status).toBe(400);
  });

  it('404 quando create_child com parent_id inexistente no catálogo', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper' });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    loadCatalogSystemsFlatMock.mockResolvedValue([]);

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_child', parent_id: 'inexistente', node_type: 'edition' });

    expect(res.status).toBe(404);
  });

  it('400 quando create_child com node_type inválido', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper' });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'create_child', parent_id: 'dd', node_type: 'invalido' });

    expect(res.status).toBe(400);
  });

  it('T4.6 — re-tentativa: casa outras sugestões pending com o mesmo raw_value no mesmo commit', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper', suggested_by_user_id: null });
    trx.otherPendingUpdate.execute = vi.fn().mockResolvedValue([{ id: 's2', material_id: 'material-2' }]);
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'scraper', suggested_by_user_id: null }));

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_node_id: 'dd5e' });

    expect(res.status).toBe(200);
    expect(trx.updateTable).toHaveBeenCalledWith('download_system_suggestion');
    expect(trx.updateTable).toHaveBeenCalledWith('download_material');
    // 1 update da própria sugestão (approve) + 1 update-em-lote da re-tentativa (.returning()).
    expect(trx.suggestionUpdate.set).toHaveBeenCalledTimes(2);
    // 1 material da própria sugestão + 1 material da sugestão relinkada (s2).
    expect(trx.materialUpdate.set).toHaveBeenCalledTimes(2);
  });

  it('reject: grava rejection_reason, notifica source=user', async () => {
    const trx = makeTrx();
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'user', suggested_by_user_id: 'user-1' }));

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'reject', reason: 'Duplicata de outro sistema já cadastrado.' });

    expect(res.status).toBe(200);
    expect(trx.suggestionUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected', rejection_reason: 'Duplicata de outro sistema já cadastrado.' }));
    expect(emitNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', kind: 'system_suggestion_resolved' }),
      expect.anything(),
    );
  });

  it('source=scraper nunca notifica ninguém', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper', suggested_by_user_id: null });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ material_id: 'material-1', raw_value: 'X', source: 'scraper', suggested_by_user_id: null }));

    await request(app()).post('/api/v1/admin/system-suggestions/s1/resolve').send({ resolution_type: 'reject' });

    expect(emitNotificationMock).not.toHaveBeenCalled();
  });

  it('404 quando sugestão não é pending (lock não acha nada)', async () => {
    const trx = makeTrx(null);
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_node_id: 'dd5e' });

    expect(res.status).toBe(404);
  });

  it('400 quando merge_existing sem target_node_id', async () => {
    const trx = makeTrx({ ...SUGGESTION, source: 'scraper' });
    dbMocks.transaction.mockReturnValue({ execute: async (cb: (trx: unknown) => Promise<unknown>) => cb(trx) });

    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing' });

    expect(res.status).toBe(400);
  });

  it('400 em resolution_type inválido', async () => {
    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'invalido' });

    expect(res.status).toBe(400);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it('403 pra usuário comum', async () => {
    currentUser = { userId: 'user-1', role: 'user' as unknown as 'admin' };
    const res = await request(app())
      .post('/api/v1/admin/system-suggestions/s1/resolve')
      .send({ resolution_type: 'merge_existing', target_node_id: 'dd5e' });
    expect(res.status).toBe(403);
  });
});
