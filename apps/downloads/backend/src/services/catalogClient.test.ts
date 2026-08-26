// T4.11 (spec 086, Fase 4) — resolveCatalogNode com resposta ok/404/timeout
// (sem rede real, catalogFetch mockado), + snapshot achatado com cache TTL,
// + escrita (createCatalogNode/addCatalogNodeAlias).

const catalogFetchMock = vi.hoisted(() => vi.fn());
// T7.1c (spec 096): mock PARCIAL. A leitura daqui continua chamando
// `catalogFetch` direto (por isso o mock), mas `createCatalogNode` deixou de ser
// cópia local e agora vem do pacote — substituir o módulo inteiro apagava a
// função real que o wrapper chama. O `importOriginal` preserva o resto; o teste
// da escrita stuba `globalThis.fetch`, um nível abaixo, porque o
// `createCatalogNode` do pacote fecha sobre o `catalogFetch` interno dele e não
// enxerga este mock.
vi.mock('@artificio/catalog-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  catalogFetch: catalogFetchMock,
}));

import {
  getCatalogNodeById,
  loadCatalogSystemsFlat,
  invalidateCatalogSnapshotCache,
  createCatalogNode,
  addCatalogNodeAlias,
  loadCatalogMaterialTypes,
  getCatalogMaterialTypeById,
  getCatalogMaterialTypeBySlug,
  invalidateCatalogMaterialTypesCache,
} from './catalogClient';

beforeEach(() => {
  catalogFetchMock.mockReset();
  invalidateCatalogSnapshotCache();
  invalidateCatalogMaterialTypesCache();
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
    expect(catalogFetchMock).toHaveBeenCalledWith('/api/catalog/v1/snapshot');
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

describe('material types catalog', () => {
  const adventure = {
    id: 'b071ab5e-2d16-4c58-8f0e-086000000001',
    slug: 'aventura',
    name: 'Aventura',
    aliases: ['adventure'],
    status: 'active',
  };

  it('normaliza resposta externa e usa cache compartilhado', async () => {
    catalogFetchMock.mockResolvedValue({ items: [adventure] });

    expect(await getCatalogMaterialTypeById(adventure.id)).toEqual(adventure);
    expect(await getCatalogMaterialTypeBySlug('ADVENTURE')).toEqual(adventure);
    expect(await loadCatalogMaterialTypes()).toEqual([adventure]);

    expect(catalogFetchMock).toHaveBeenCalledTimes(1);
    expect(catalogFetchMock).toHaveBeenCalledWith('/api/catalog/v1/material-types');
  });

  it('rejeita payload Central malformado', async () => {
    catalogFetchMock.mockResolvedValue({ items: [{ ...adventure, id: 'nao-uuid' }] });

    await expect(loadCatalogMaterialTypes()).rejects.toThrow();
  });

  it('preserva Aventura e o tipo neutro quando a rota do Site está ausente', async () => {
    catalogFetchMock.mockRejectedValue(new Error('catalog_404: not_found'));

    expect(await loadCatalogMaterialTypes()).toEqual([
      { ...adventure, aliases: ['adventure', 'aventuras'] },
      expect.objectContaining({
        id: 'b071ab5e-2d16-4c58-8f0e-086000000007',
        slug: 'nao-classificado',
        status: 'active',
      }),
    ]);
    expect(await getCatalogMaterialTypeBySlug('aventuras')).toMatchObject({ id: adventure.id });
    expect(await getCatalogMaterialTypeBySlug('nao-classificado')).toMatchObject({
      id: 'b071ab5e-2d16-4c58-8f0e-086000000007',
    });
    expect(catalogFetchMock).toHaveBeenCalledTimes(1);
  });

  it('não mascara falha Central diferente de rota ausente', async () => {
    catalogFetchMock.mockRejectedValue(new Error('catalog_503: unavailable'));

    await expect(loadCatalogMaterialTypes()).rejects.toThrow('catalog_503');
  });
});

describe('createCatalogNode', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('envia POST com canonical_slug derivado do nome e invalida o cache', async () => {
    catalogFetchMock.mockResolvedValueOnce({ tree: TREE }); // popula cache
    await loadCatalogSystemsFlat();

    process.env.CATALOG_API_URL = 'https://site.artificiorpg.com';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'novo', parent_id: null, node_type: 'system', canonical_slug: 'sistema-novo', path_slug: 'sistema-novo',
        name: 'Sistema Novo', name_pt: null, aliases: [{ alias: 'Hint Bruto' }],
      }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const created = await createCatalogNode({ name: 'Sistema Novo', node_type: 'system', aliases: ['Hint Bruto'] });

    expect(created.id).toBe('novo');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/admin/v1/catalog/nodes');
    expect((fetchSpy.mock.calls[0][1] as { method: string }).method).toBe('POST');
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as { body: string }).body);
    expect(body.canonical_slug).toBe('sistema-novo');
    expect(body.aliases).toEqual(['Hint Bruto']);

    // Cache invalidado — próxima leitura busca de novo (pelo catalogFetch daqui).
    globalThis.fetch = originalFetch;
    catalogFetchMock.mockResolvedValueOnce({ tree: TREE });
    await loadCatalogSystemsFlat();
    expect(catalogFetchMock).toHaveBeenCalledTimes(2);
  });
});

// DEB-088-04 — o contrato mudou de read-modify-write para acréscimo atômico.
// Estes testes descreviam o comportamento antigo (ler a lista, concatenar,
// reenviar tudo) e foram reescritos para o novo, não removidos: a garantia que
// importa continua sendo "nunca apagar o vocabulário já aprendido", só que
// agora ela vem do banco (ON CONFLICT DO NOTHING) e não de uma leitura prévia
// que duas aprovações concorrentes podiam ler idêntica.
describe('addCatalogNodeAlias', () => {
  it('envia add_aliases, nunca a lista inteira em aliases', async () => {
    catalogFetchMock.mockResolvedValueOnce({});

    await addCatalogNodeAlias('dd', 'Hint Novo');

    const putCall = catalogFetchMock.mock.calls.find((call) => call[1]?.method === 'PUT');
    const body = JSON.parse((putCall?.[1] as { body: string }).body);
    expect(body).toEqual({ add_aliases: ['Hint Novo'] });
    // `aliases` presente reescreveria a lista inteira no site (replaceAliases
    // faz DELETE+INSERT) — é exatamente o que causava a perda concorrente.
    expect(body).not.toHaveProperty('aliases');
  });

  it('não lê o node antes de escrever — uma requisição só', async () => {
    catalogFetchMock.mockResolvedValueOnce({});

    await addCatalogNodeAlias('dd', 'Hint Novo');

    // A leitura prévia era metade do defeito: entre ela e o PUT havia janela
    // para outra aprovação gravar, e a lista lida virava obsoleta.
    expect(catalogFetchMock).toHaveBeenCalledTimes(1);
  });

  it('propaga falha do catálogo em vez de engolir', async () => {
    catalogFetchMock.mockRejectedValue(new Error('catalog_404: not_found'));

    // Node inexistente agora é 404 do próprio PUT, não uma checagem local: o
    // erro real do catálogo sobe sem ser reembalado.
    await expect(addCatalogNodeAlias('inexistente', 'Alias')).rejects.toThrow('catalog_404');
  });
});
