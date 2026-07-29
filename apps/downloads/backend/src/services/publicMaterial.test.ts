import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ selectFrom: vi.fn() }));
vi.mock('../db', () => ({ db: { selectFrom: mocks.selectFrom } }));

import { findPublishedMaterialBySlug } from './publicMaterial';

describe('consulta pública compartilhada de material', () => {
  beforeEach(() => mocks.selectFrom.mockReset());

  it('restringe simultaneamente ao slug e ao estado published', async () => {
    const query = {
      leftJoin: vi.fn(),
      select: vi.fn(),
      where: vi.fn(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    };
    query.leftJoin.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.where.mockReturnValue(query);
    mocks.selectFrom.mockReturnValue(query);

    await findPublishedMaterialBySlug('segredo');

    expect(query.where).toHaveBeenNthCalledWith(1, 'download_material.slug', '=', 'segredo');
    expect(query.where).toHaveBeenNthCalledWith(2, 'download_material.editorial_state', '=', 'published');
    expect(query.executeTakeFirst).toHaveBeenCalledOnce();
  });
});
