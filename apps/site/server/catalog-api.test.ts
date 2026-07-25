import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const catalogMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  getProjectionSnapshot: vi.fn(),
  resolveNode: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
}));

const materialTypeMocks = vi.hoisted(() => ({
  listMaterialTypes: vi.fn(),
  createMaterialType: vi.fn(),
  updateMaterialType: vi.fn(),
}));

vi.mock('../db/repo/catalog.js', () => catalogMocks);
vi.mock('../db/repo/materialTypes.js', () => materialTypeMocks);

import { catalogApi } from './catalog-api';

const servers: Array<ReturnType<ReturnType<typeof express>['listen']>> = [];

async function call(router: express.Router, path: string, init?: RequestInit) {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test_server_address_missing');
  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe('catalog public API', () => {
  it('expõe snapshot canônico com ETag', async () => {
    catalogMocks.getSnapshot.mockResolvedValue({ checksum: 'abc', tree: [], catalog_version: 1, nodes_count: 0 });

    const response = await call(catalogApi(), '/snapshot');

    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(await response.json()).toMatchObject({ checksum: 'abc', tree: [] });
  });

  it('lista somente tipos ativos pelo repositório público', async () => {
    materialTypeMocks.listMaterialTypes.mockResolvedValue([{ id: 'type-1', name: 'Aventura' }]);

    const response = await call(catalogApi(), '/material-types');

    expect(response.status).toBe(200);
    expect(materialTypeMocks.listMaterialTypes).toHaveBeenCalledWith();
    expect(await response.json()).toEqual({ items: [{ id: 'type-1', name: 'Aventura' }] });
  });
});
