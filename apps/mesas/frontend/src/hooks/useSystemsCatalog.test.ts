// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authGet } from '../services/apiClient';
import {
  invalidateSystemsCatalogCache,
  loadSystemsCatalog,
  useSystemsCatalog,
} from './useSystemsCatalog';

vi.mock('../services/apiClient', () => ({
  authGet: vi.fn(),
}));

const mockAuthGet = vi.mocked(authGet);

const systemPayload = {
  id: 'dnd',
  name: 'Dungeons & Dragons',
  name_pt: 'Dungeons & Dragons',
  slug: 'dungeons-dragons',
  parent_id: null,
  node_type: 'system',
  depth: 0,
  path_slug: 'dungeons-dragons',
  logo_filename: 'dnd.svg',
  website_url: 'https://dnd.wizards.com',
  aliases: ['D&D'],
  has_children: true,
  children_count: 1,
  tables_count: 2,
  aliases_count: 1,
  children: [
    {
      id: 'dnd-5e',
      name: '5e',
      name_pt: null,
      slug: '5e',
      parent_id: 'dnd',
      node_type: 'edition',
      depth: 1,
      path_slug: 'dungeons-dragons/5e',
      logo_filename: null,
      website_url: null,
      aliases: ['5th edition'],
      has_children: false,
      children_count: 0,
      tables_count: 1,
      aliases_count: 1,
      children: [],
    },
  ],
};

const okResponse = (data: unknown) => Promise.resolve({
  ok: true,
  json: async () => ({ data }),
} as Response);

const errorResponse = () => Promise.resolve({
  ok: false,
  json: async () => ({}),
} as Response);

describe('useSystemsCatalog', () => {
  beforeEach(() => {
    invalidateSystemsCatalogCache();
    mockAuthGet.mockReset();
  });

  it('normaliza a árvore sem descartar slug, tipo, filhos, aliases, logo, website e contadores', async () => {
    mockAuthGet.mockImplementation(() => okResponse([systemPayload]));

    const tree = await loadSystemsCatalog(true);

    expect(tree[0]).toMatchObject({
      slug: 'dungeons-dragons',
      node_type: 'system',
      logo_filename: 'dnd.svg',
      website_url: 'https://dnd.wizards.com',
      aliases: ['D&D'],
      children_count: 1,
      tables_count: 2,
      aliases_count: 1,
    });
    expect(tree[0].children?.[0]).toMatchObject({
      name: '5e',
      node_type: 'edition',
      aliases: ['5th edition'],
    });
  });

  it('usa cache TTL e permite forceRefresh manual', async () => {
    mockAuthGet.mockImplementation(() => okResponse([systemPayload]));

    await loadSystemsCatalog();
    await loadSystemsCatalog();
    await loadSystemsCatalog(true);

    expect(mockAuthGet).toHaveBeenCalledTimes(2);
  });

  it('expõe loading, dados flat e erro simulado no hook', async () => {
    mockAuthGet.mockImplementationOnce(() => okResponse([systemPayload]));

    const { result } = renderHook(() => useSystemsCatalog());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.tree).toHaveLength(1);
      expect(result.current.flat.map((node) => node.id)).toEqual(['dnd', 'dnd-5e']);
    });

    mockAuthGet.mockImplementationOnce(errorResponse);

    await expect(result.current.forceRefresh()).rejects.toThrow('Erro ao carregar sistemas.');

    await waitFor(() => {
      expect(result.current.error).toBe('Erro ao carregar sistemas.');
      expect(result.current.loading).toBe(false);
    });
  });
});
