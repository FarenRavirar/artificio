import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { catalogFetch, checkCatalogHealth } from './index.js';

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
