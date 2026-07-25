import express, { type NextFunction, type Request, type Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const materialTypeMocks = vi.hoisted(() => ({
  listMaterialTypes: vi.fn(),
  createMaterialType: vi.fn(),
  updateMaterialType: vi.fn(),
}));

vi.mock('../db/repo/materialTypes.js', () => materialTypeMocks);

import { catalogMaterialTypesAdminApi } from './catalog-material-types-admin-api';

const servers: Array<ReturnType<ReturnType<typeof express>['listen']>> = [];
const pass = (_req: Request, _res: Response, next: NextFunction) => next();

async function call(path: string, init?: RequestInit) {
  const app = express();
  app.use(express.json());
  app.use(catalogMaterialTypesAdminApi(pass, pass));
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

describe('catalog material types admin API', () => {
  it('lista inclusive inativos', async () => {
    materialTypeMocks.listMaterialTypes.mockResolvedValue([{ id: 'type-1', status: 'rejected' }]);

    const response = await call('/');

    expect(response.status).toBe(200);
    expect(materialTypeMocks.listMaterialTypes).toHaveBeenCalledWith(true);
  });

  it('registra tipo pelo contrato autenticado', async () => {
    materialTypeMocks.createMaterialType.mockResolvedValue({ id: 'type-1', name: 'Aventura' });

    const response = await call('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Aventura', aliases: ['adventure'] }),
    });

    expect(response.status).toBe(201);
    expect(materialTypeMocks.createMaterialType).toHaveBeenCalledWith({
      name: 'Aventura', slug: undefined, aliases: ['adventure'], status: undefined,
    }, null);
  });

  it('atualiza tipo e preserva 404', async () => {
    materialTypeMocks.updateMaterialType.mockResolvedValueOnce({ id: 'type-1', name: 'Aventuras' });
    expect((await call('/type-1', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Aventuras' }),
    })).status).toBe(200);

    materialTypeMocks.updateMaterialType.mockResolvedValueOnce(null);
    expect((await call('/missing', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Outro' }),
    })).status).toBe(404);
  });

  it.each([
    ['POST', '/', { name: 42 }],
    ['POST', '/', { name: 'Aventura', slug: {} }],
    ['POST', '/', { name: 'Aventura', status: false }],
    ['POST', '/', { name: 'Aventura', aliases: ['ok', 7] }],
    ['PUT', '/type-1', { name: null }],
    ['PUT', '/type-1', { aliases: 'adventure' }],
  ])('rejeita payload malformado em %s %s', async (method, path, body) => {
    const response = await call(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad_payload' });
    expect(materialTypeMocks.createMaterialType).not.toHaveBeenCalled();
    expect(materialTypeMocks.updateMaterialType).not.toHaveBeenCalled();
  });
});
