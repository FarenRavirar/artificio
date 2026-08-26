import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  catalogFetch,
  checkCatalogHealth,
  createCatalogNode,
  updateCatalogNode,
  slugifyCatalogSegment,
} from './index.js';

describe('catalogFetch', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CATALOG_API_URL = 'https://site.artificiorpg.com';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('lança erro quando CATALOG_API_URL ausente', async () => {
    delete process.env.CATALOG_API_URL;
    delete process.env.CENTRAL_CATALOG_URL;
    delete process.env.SITE_API_URL;
    await expect(catalogFetch('/api/catalog/v1/health')).rejects.toThrow('CATALOG_API_URL ausente');
  });

  it('lança erro descritivo em resposta HTTP não-ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'indisponível',
    }) as unknown as typeof fetch;
    await expect(catalogFetch('/api/catalog/v1/health')).rejects.toThrow('catalog_503');
  });

  it('checkCatalogHealth valida o shape da resposta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, catalog_version: 1, nodes_count: 10, checksum: 'abc' }),
    }) as unknown as typeof fetch;
    const health = await checkCatalogHealth();
    expect(health).toEqual({ ok: true, catalog_version: 1, nodes_count: 10, checksum: 'abc' });
  });
});

// T7.1c (spec 096): a escrita no catálogo central estava duplicada em `mesas` e
// `downloads`, falando com a MESMA rota e validando contratos diferentes. Estes
// testes fixam o contrato agora que ele tem um dono só.
describe('slugifyCatalogSegment', () => {
  it('traduz & para " e " (contrato do catálogo central; a cópia do downloads não fazia)', () => {
    expect(slugifyCatalogSegment('D&D 5e')).toBe('d-e-d-5e');
  });

  it('remove acentos e colapsa separadores', () => {
    expect(slugifyCatalogSegment('Vampiro: A Máscara')).toBe('vampiro-a-mascara');
  });

  it('não deixa hífen sobrando quando o corte em 80 cai num separador (PR #204)', () => {
    const slug = slugifyCatalogSegment(`${'a'.repeat(79)} xyz`);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it('não deixa hífen nas pontas da entrada', () => {
    expect(slugifyCatalogSegment('  --Pathfinder--  ')).toBe('pathfinder');
  });
});

describe('createCatalogNode / updateCatalogNode', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  const nodeResponse = {
    id: 'node-1',
    parent_id: null,
    node_type: 'system',
    canonical_slug: 'd-e-d',
    path_slug: 'd-e-d',
    name: 'D&D',
    name_pt: null,
    description: null,
    official_website_url: null,
    logo_media_id: null,
    aliases: [{ alias: 'dnd' }],
  };

  function mockFetchOk() {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => nodeResponse });
    globalThis.fetch = spy as unknown as typeof fetch;
    return spy;
  }

  function bodyOf(spy: ReturnType<typeof vi.fn>): Record<string, unknown> {
    const init = spy.mock.calls[0][1] as { body: string };
    return JSON.parse(init.body) as Record<string, unknown>;
  }

  beforeEach(() => {
    process.env.CATALOG_API_URL = 'https://site.artificiorpg.com';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('POSTa em /api/admin/v1/catalog/nodes com o slug canônico derivado do nome', async () => {
    const spy = mockFetchOk();
    await createCatalogNode({ name: 'D&D', node_type: 'system' });

    expect(String(spy.mock.calls[0][0])).toContain('/api/admin/v1/catalog/nodes');
    expect(bodyOf(spy).canonical_slug).toBe('d-e-d');
  });

  // Campos que só o `mesas` mandava: perdê-los na unificação seria regressão
  // silenciosa (o app continuaria compilando e gravaria nó sem site/logo).
  it('envia description, site e logo quando o nó é um sistema', async () => {
    const spy = mockFetchOk();
    await createCatalogNode({
      name: 'D&D',
      node_type: 'system',
      description: 'clássico',
      website_url: 'https://dnd.example',
      logo_filename: 'media-1',
    });

    const body = bodyOf(spy);
    expect(body.description).toBe('clássico');
    expect(body.official_website_url).toBe('https://dnd.example');
    expect(body.logo_media_id).toBe('media-1');
  });

  it('anula site e logo em edição/variante (são identidade do sistema)', async () => {
    const spy = mockFetchOk();
    await createCatalogNode({
      name: '5e',
      node_type: 'edition',
      parent_id: 'node-1',
      website_url: 'https://dnd.example',
      logo_filename: 'media-1',
    });

    const body = bodyOf(spy);
    expect(body.official_website_url).toBeNull();
    expect(body.logo_media_id).toBeNull();
  });

  it('filtra alias não-string antes de enviar (defesa em profundidade, PR #145)', async () => {
    const spy = mockFetchOk();
    await createCatalogNode({
      name: 'D&D',
      node_type: 'system',
      aliases: ['dnd', '  ', 42 as unknown as string, 'dungeons'],
    });

    expect(bodyOf(spy).aliases).toEqual(['dnd', 'dungeons']);
  });

  it('normaliza para null os campos que o site pode omitir', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'node-1',
        parent_id: null,
        node_type: 'system',
        canonical_slug: 'x',
        path_slug: 'x',
        name: 'X',
        name_pt: null,
        aliases: [],
      }),
    }) as unknown as typeof fetch;

    const created = await createCatalogNode({ name: 'X', node_type: 'system' });
    expect(created.description).toBeNull();
    expect(created.official_website_url).toBeNull();
    expect(created.logo_media_id).toBeNull();
  });

  // Achado CodeRabbit (PR #145): array vazio é replace explícito no site — o PUT
  // sem aliases apagaria todos os existentes.
  it('PUT omite aliases quando o input não os declara', async () => {
    const spy = mockFetchOk();
    await updateCatalogNode('node-1', { name: 'D&D', node_type: 'system' });

    expect(bodyOf(spy)).not.toHaveProperty('aliases');
  });

  // Achado real (review PR #289): o PUT mandava `null` em campo OMITIDO, e o
  // site trata `null` como "apague isto". O caminho real é
  // `appendAliasesToNode` no mesas, que passa nome/descrição/parent e não passa
  // site/logo — toda aprovação de sugestão com alias novo os limparia.
  it('PUT omite campos que o input não menciona, em vez de mandar null', async () => {
    const spy = mockFetchOk();
    await updateCatalogNode('node-1', { name: 'D&D', node_type: 'system', aliases: ['dnd'] });

    const body = bodyOf(spy);
    expect(body).not.toHaveProperty('official_website_url');
    expect(body).not.toHaveProperty('logo_media_id');
    expect(body).not.toHaveProperty('description');
    // O que o chamador mandou continua indo.
    expect(body.name).toBe('D&D');
    expect(body.aliases).toEqual(['dnd']);
  });

  // `parent_id: null` não apaga um campo — REPARENTA o nó para a raiz.
  it('PUT omite parent_id e name_pt quando o input não os menciona', async () => {
    const spy = mockFetchOk();
    await updateCatalogNode('node-1', { name: 'D&D', node_type: 'edition' });

    const body = bodyOf(spy);
    expect(body).not.toHaveProperty('parent_id');
    expect(body).not.toHaveProperty('name_pt');
  });

  it('PUT envia parent_id e name_pt explícitos, inclusive null', async () => {
    const spy = mockFetchOk();
    await updateCatalogNode('node-1', {
      name: 'D&D',
      node_type: 'edition',
      parent_id: null,
      name_pt: 'Dungeons',
    });

    const body = bodyOf(spy);
    expect(body.parent_id).toBeNull();
    expect(body.name_pt).toBe('Dungeons');
  });

  it('PUT envia null quando o input o declara EXPLICITAMENTE (limpeza intencional)', async () => {
    const spy = mockFetchOk();
    await updateCatalogNode('node-1', {
      name: 'D&D',
      node_type: 'system',
      website_url: null,
      description: null,
    });

    const body = bodyOf(spy);
    expect(body.official_website_url).toBeNull();
    expect(body.description).toBeNull();
    // Não mencionado: continua fora.
    expect(body).not.toHaveProperty('logo_media_id');
  });

  it('POST segue mandando null em campo ausente (nó nascendo, nada a perder)', async () => {
    const spy = mockFetchOk();
    await createCatalogNode({ name: 'D&D', node_type: 'system' });

    const body = bodyOf(spy);
    expect(body.official_website_url).toBeNull();
    expect(body.logo_media_id).toBeNull();
  });

  it('PUT envia aliases quando o input os declara, inclusive vazio (replace explícito)', async () => {
    const spy = mockFetchOk();
    await updateCatalogNode('node-1', { name: 'D&D', node_type: 'system', aliases: [] });

    expect(bodyOf(spy).aliases).toEqual([]);
  });
});
