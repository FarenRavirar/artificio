// T4.11 (spec 086, Fase 4) — resolveCatalogNode com resposta ok/404/timeout
// (sem rede real, catalogFetch mockado), + snapshot achatado com cache TTL,
// + escrita (createCatalogNode/addCatalogNodeAlias).

const catalogFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@artificio/catalog-client', () => ({
  catalogFetch: catalogFetchMock,
}));

import {
  getCatalogNodeById,
  loadCatalogSystemsFlat,
  invalidateCatalogSnapshotCache,
  createCatalogNode,
  addCatalogNodeAlias,
} from './catalogClient';

beforeEach(() => {
  catalogFetchMock.mockReset();
  invalidateCatalogSnapshotCache();
});

describe('getCatalogNodeById', () => {
  it('devolve o node quando a resposta é ok', async () => {
    catalogFetchMock.mockResolvedValue({ id: 'dd', name: 'D&D', name_pt: null, canonical_slug: 'dnd', node_type: 'system', aliases: [{ alias: 'DnD' }] });

    const node = await getCatalogNodeById('dd');

    expect(node?.id).toBe('dd');
    expect(catalogFetchMock).toHaveBeenCalledWith('/api/catalog/v1/nodes/dd');
  });

  it('devolve null em 404 (catalogFetch lança)', async () => {
    catalogFetchMock.mockRejectedValue(new Error('catalog_404: not_found'));

    const node = await getCatalogNodeById('inexistente');

    expect(node).toBeNull();
  });

  it('propaga timeout/erro de rede (achado real PR #204: não é o mesmo que 404)', async () => {
    catalogFetchMock.mockRejectedValue(new Error('The operation was aborted'));

    await expect(getCatalogNodeById('dd')).rejects.toThrow('The operation was aborted');
  });
});

const TREE = [
  {
    id: 'dd', parent_id: null, node_type: 'system', canonical_slug: 'dnd', path_slug: 'dnd',
    name: 'Dungeons & Dragons', name_pt: null, aliases: [{ alias: 'D&D' }],
    children: [
      {
        id: 'dd5e', parent_id: 'dd', node_type: 'edition', canonical_slug: '5e', path_slug: 'dnd/5e',
        name: '5th Edition', name_pt: '5ª Edição', aliases: [],
        children: [],
      },
    ],
  },
];

describe('loadCatalogSystemsFlat', () => {
  it('achata a árvore em lista flat, preservando parent_id e aliases', async () => {
    catalogFetchMock.mockResolvedValue({ tree: TREE });

    const flat = await loadCatalogSystemsFlat();

    expect(flat).toHaveLength(2);
    expect(flat.find((n) => n.id === 'dd5e')).toMatchObject({ parent_id: 'dd', name: '5th Edition', name_pt: '5ª Edição' });
    expect(flat.find((n) => n.id === 'dd')?.aliases).toEqual(['D&D']);
  });

  it('usa cache dentro do TTL — uma única chamada de rede pra 2 leituras seguidas', async () => {
    catalogFetchMock.mockResolvedValue({ tree: TREE });

    await loadCatalogSystemsFlat();
    await loadCatalogSystemsFlat();

    expect(catalogFetchMock).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh ignora o cache', async () => {
    catalogFetchMock.mockResolvedValue({ tree: TREE });

    await loadCatalogSystemsFlat();
    await loadCatalogSystemsFlat(true);

    expect(catalogFetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('createCatalogNode', () => {
  it('envia POST com canonical_slug derivado do nome e invalida o cache', async () => {
    catalogFetchMock.mockResolvedValueOnce({ tree: TREE }); // popula cache
    await loadCatalogSystemsFlat();

    catalogFetchMock.mockResolvedValueOnce({
      id: 'novo', parent_id: null, node_type: 'system', canonical_slug: 'sistema-novo', path_slug: 'sistema-novo',
      name: 'Sistema Novo', name_pt: null, aliases: [{ alias: 'Hint Bruto' }],
    });

    const created = await createCatalogNode({ name: 'Sistema Novo', node_type: 'system', aliases: ['Hint Bruto'] });

    expect(created.id).toBe('novo');
    expect(catalogFetchMock).toHaveBeenLastCalledWith('/api/admin/v1/catalog/nodes', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((catalogFetchMock.mock.calls.at(-1)?.[1] as { body: string }).body);
    expect(body.canonical_slug).toBe('sistema-novo');
    expect(body.aliases).toEqual(['Hint Bruto']);

    // Cache invalidado — próxima leitura busca de novo.
    catalogFetchMock.mockResolvedValueOnce({ tree: TREE });
    await loadCatalogSystemsFlat();
    expect(catalogFetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('addCatalogNodeAlias', () => {
  it('adiciona alias novo preservando os existentes (nunca aliases:[])', async () => {
    catalogFetchMock.mockResolvedValueOnce({ id: 'dd', name: 'D&D', name_pt: null, canonical_slug: 'dnd', node_type: 'system', aliases: [{ alias: 'DnD' }] });
    catalogFetchMock.mockResolvedValueOnce({});

    await addCatalogNodeAlias('dd', 'Hint Novo');

    const putCall = catalogFetchMock.mock.calls.find((call) => call[1]?.method === 'PUT');
    const body = JSON.parse((putCall?.[1] as { body: string }).body);
    expect(body.aliases).toEqual(['DnD', 'Hint Novo']);
    expect(body.node_type).toBe('system');
    expect(body.name).toBe('D&D');
  });

  it('não duplica alias já existente (não chama PUT)', async () => {
    catalogFetchMock.mockResolvedValueOnce({ id: 'dd', name: 'D&D', name_pt: null, canonical_slug: 'dnd', node_type: 'system', aliases: [{ alias: 'DnD' }] });

    await addCatalogNodeAlias('dd', 'DnD');

    expect(catalogFetchMock).toHaveBeenCalledTimes(1);
  });

  it('lança erro descritivo quando o node não existe', async () => {
    catalogFetchMock.mockRejectedValue(new Error('catalog_404: not_found'));

    await expect(addCatalogNodeAlias('inexistente', 'Alias')).rejects.toThrow('catalog_node_not_found');
  });
});
