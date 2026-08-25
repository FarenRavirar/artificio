import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { MesasSystemNode } from '../services/catalogClient.js';

// T4.0h-ter (spec 096, R18/A21): GET /systems?parent_id=... devolve os filhos
// diretos de um nó com o mesmo formato de nó já usado (aliases populados).
// TRAVA do catálogo central (plan.md §Catálogo central): o parâmetro tem de
// valer nas DUAS fontes — centralProvider (produção) e localProvider
// (beta/dev) implementam a mesma interface, e a rota resolve sobre ela. Estes
// testes exercitam o MESMO handler com um provider de cada fonte para provar
// que não há caminho especial por ambiente.
vi.mock('../services/systemCatalogProvider.js', () => ({
  getSystemCatalogProvider: vi.fn(),
}));

import systemsRoutes from './systems.js';
import { getSystemCatalogProvider } from '../services/systemCatalogProvider.js';

function makeApp() {
  const app = express();
  app.use('/api/v1/systems', systemsRoutes);
  return app;
}

function node(
  id: string,
  parentId: string | null,
  overrides: Partial<MesasSystemNode> = {},
): MesasSystemNode {
  return {
    id,
    name: id,
    name_pt: null,
    slug: id,
    parent_id: parentId,
    node_type: 'system',
    depth: 0,
    path_slug: null,
    description: null,
    logo_filename: null,
    website_url: null,
    aliases: [],
    has_children: false,
    children_count: 0,
    tables_count: 0,
    aliases_count: 0,
    children: [],
    ...overrides,
  };
}

// Fonte CENTRAL (produção): lê o snapshot do site-admin via loadCatalogFlat.
const CENTRAL_FLAT: MesasSystemNode[] = [
  node('sys-dnd', null, { name: 'Dungeons & Dragons', aliases: ['D&D', 'DnD'], has_children: true, children_count: 2 }),
  node('ed-5e', 'sys-dnd', { name: '5ª Edição', aliases: ['5e'], node_type: 'edition', depth: 1, has_children: true, children_count: 1 }),
  node('var-2024', 'ed-5e', { name: '5e 2024', aliases: [], node_type: 'variant', depth: 2 }),
  node('ed-5e-old', 'sys-dnd', { name: 'Versão 2014', aliases: [], node_type: 'edition', depth: 1 }),
  node('sys-vamp', null, { name: 'Vampire', aliases: ['VtM', 'Vampiro'], has_children: true, children_count: 1 }),
  node('ed-v5', 'sys-vamp', { name: '5ª Edição VtM', aliases: [], node_type: 'edition', depth: 1 }),
];

// Fonte LOCAL (beta/dev): projeção em tabela própria (loadLocalFlat) — dados
// distintos de propósito, para provar que a rota não especializa por fonte.
const LOCAL_FLAT: MesasSystemNode[] = [
  node('sys-coc', null, { name: 'Call of Cthulhu', aliases: ['CoC'], has_children: true, children_count: 2 }),
  node('ed-coc7', 'sys-coc', { name: '7ª Edição', aliases: [], node_type: 'edition', depth: 1 }),
  node('ed-coc6', 'sys-coc', { name: '6ª Edição', aliases: [], node_type: 'edition', depth: 1 }),
];

function mockProvider(source: 'central' | 'local', flat: MesasSystemNode[]) {
  const provider = {
    source,
    loadFlat: vi.fn().mockResolvedValue(flat),
    loadTree: vi.fn().mockResolvedValue([]),
  };
  (getSystemCatalogProvider as Mock).mockReturnValue(provider);
  return provider;
}

describe('GET /api/v1/systems?parent_id — filhos diretos (T4.0h-ter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('centralProvider: devolve os filhos diretos com aliases/has_children/children_count populados', async () => {
    const provider = mockProvider('central', CENTRAL_FLAT);

    const res = await request(makeApp()).get('/api/v1/systems?parent_id=sys-dnd');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 'ed-5e',
        parent_id: 'sys-dnd',
        aliases: ['5e'],
        has_children: true,
        children_count: 1,
        children: [],
      }),
      expect.objectContaining({ id: 'ed-5e-old', parent_id: 'sys-dnd', aliases: [] }),
    ]);
    expect(provider.loadFlat).toHaveBeenCalledTimes(1);
    expect(provider.loadTree).not.toHaveBeenCalled();
  });

  it('localProvider: mesma interface, mesmo resultado — nada é resolvido só no central', async () => {
    const provider = mockProvider('local', LOCAL_FLAT);

    const res = await request(makeApp()).get('/api/v1/systems?parent_id=sys-coc');

    expect(res.status).toBe(200);
    expect(res.body.data.map((n: MesasSystemNode) => n.id)).toEqual(['ed-coc7', 'ed-coc6']);
    expect(provider.loadFlat).toHaveBeenCalledTimes(1);
  });

  it('combina parent_id + search, casando nome e alias do filho', async () => {
    mockProvider('central', CENTRAL_FLAT);

    // "ediç" casa nome de "5ª Edição" (filho de sys-dnd).
    const byName = await request(makeApp())
      .get('/api/v1/systems?parent_id=sys-dnd&search=ediç');
    expect(byName.status).toBe(200);
    expect(byName.body.data.map((n: MesasSystemNode) => n.id)).toEqual(['ed-5e']);

    // Alias "Vampiro" é do PAI (sys-vamp), não do filho — filho por alias não
    // casa e a resposta é vazia, provando que a busca filtra o NÍVEL, não a
    // árvore acima dele.
    const byAlias = await request(makeApp())
      .get('/api/v1/systems?parent_id=sys-vamp&search=Vampiro');
    expect(byAlias.status).toBe(200);
    expect(byAlias.body.data).toEqual([]);
  });

  it('pagina filhos com a mesma semântica de cursor/limit do flat', async () => {
    mockProvider('local', LOCAL_FLAT);

    const first = await request(makeApp()).get('/api/v1/systems?parent_id=sys-coc&limit=1');
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(1);
    expect(first.body.pagination.has_more).toBe(true);
    expect(first.body.pagination.next_cursor).toBe('ed-coc7');

    const second = await request(makeApp())
      .get(`/api/v1/systems?parent_id=sys-coc&limit=1&cursor=${first.body.pagination.next_cursor}`);
    expect(second.status).toBe(200);
    expect(second.body.data.map((n: MesasSystemNode) => n.id)).toEqual(['ed-coc6']);
    expect(second.body.pagination.has_more).toBe(false);
    expect(second.body.pagination.next_cursor).toBeNull();
  });

  it('parent_id desconhecido devolve lista vazia (nó sem filhos)', async () => {
    mockProvider('central', CENTRAL_FLAT);

    const res = await request(makeApp()).get('/api/v1/systems?parent_id=nao-existe');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({ next_cursor: null, has_more: false });
  });

  it('sem parent_id o comportamento antigo fica intacto (flat + view=tree)', async () => {
    const provider = mockProvider('central', CENTRAL_FLAT);

    const flatRes = await request(makeApp()).get('/api/v1/systems');
    expect(flatRes.status).toBe(200);
    expect(flatRes.body.data).toHaveLength(CENTRAL_FLAT.length);
    expect(provider.loadFlat).toHaveBeenCalledTimes(1);
    expect(provider.loadTree).not.toHaveBeenCalled();

    const treeRes = await request(makeApp()).get('/api/v1/systems?view=tree');
    expect(treeRes.status).toBe(200);
    expect(provider.loadTree).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/v1/systems?id — nó(s) por id (spec 096, R18/A21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // O editor precisa do nó JÁ selecionado (path_slug do DDAL, nome/logo do card
  // e o caminho visível) ao abrir uma mesa publicada. `search` casa nome/slug/
  // path_slug/alias, nunca id — sem este filtro o editor caía em `?view=tree`
  // (503.907 bytes por abertura), o que o A21 proíbe.
  it('devolve o nó pedido, com aliases e metadados populados', async () => {
    const provider = mockProvider('central', CENTRAL_FLAT);

    const res = await request(makeApp()).get('/api/v1/systems?id=ed-5e');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 'ed-5e',
        parent_id: 'sys-dnd',
        aliases: ['5e'],
        has_children: true,
      }),
    ]);
    expect(provider.loadFlat).toHaveBeenCalledTimes(1);
    // Nunca cai no caminho da árvore inteira — é o ponto do requisito.
    expect(provider.loadTree).not.toHaveBeenCalled();
  });

  it('aceita vários ids por vírgula e por repetição do parâmetro', async () => {
    mockProvider('central', CENTRAL_FLAT);

    const byComma = await request(makeApp()).get('/api/v1/systems?id=sys-dnd,ed-5e,var-2024');
    expect(byComma.status).toBe(200);
    expect(byComma.body.data.map((n: MesasSystemNode) => n.id)).toEqual([
      'sys-dnd',
      'ed-5e',
      'var-2024',
    ]);

    const byRepeat = await request(makeApp()).get('/api/v1/systems?id=sys-vamp&id=ed-v5');
    expect(byRepeat.status).toBe(200);
    expect(byRepeat.body.data.map((n: MesasSystemNode) => n.id)).toEqual(['sys-vamp', 'ed-v5']);
  });

  it('id desconhecido sai da resposta em vez de virar erro', async () => {
    mockProvider('central', CENTRAL_FLAT);

    const res = await request(makeApp()).get('/api/v1/systems?id=ed-5e,nao-existe');

    expect(res.status).toBe(200);
    expect(res.body.data.map((n: MesasSystemNode) => n.id)).toEqual(['ed-5e']);
  });

  it('localProvider: mesma interface, mesmo resultado — o filtro não especializa por fonte', async () => {
    const provider = mockProvider('local', LOCAL_FLAT);

    const res = await request(makeApp()).get('/api/v1/systems?id=ed-coc7');

    expect(res.status).toBe(200);
    expect(res.body.data.map((n: MesasSystemNode) => n.id)).toEqual(['ed-coc7']);
    expect(provider.loadFlat).toHaveBeenCalledTimes(1);
  });

  it('id vazio não sequestra a rota — cai no caminho normal (view/search)', async () => {
    const provider = mockProvider('central', CENTRAL_FLAT);

    const res = await request(makeApp()).get('/api/v1/systems?id=');

    expect(res.status).toBe(200);
    expect(provider.loadFlat).toHaveBeenCalled();
    expect(res.body.data.length).toBeGreaterThan(1);
  });
});
