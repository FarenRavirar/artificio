import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ selectFrom: vi.fn() }));
vi.mock('../db', () => ({ db: { selectFrom: mocks.selectFrom } }));

import { findPublishedMaterialBySlug, listPublishedMaterialSlugs } from './publicMaterial';

const VALID_PUBLIC_MATERIAL = {
  id: 'material-1',
  slug: 'material-publicado',
  title: 'Material publicado',
  summary: null,
  description: null,
  material_type: 'Aventura',
  material_type_id: 'type-1',
  access_kind: 'external_link' as const,
  external_url: 'https://example.com/material',
  system_id: null,
  edition_id: null,
  creator_id: 'creator-1',
  editorial_state: 'published' as const,
  created_at: new Date('2026-07-28T12:00:00.000Z'),
  updated_at: new Date('2026-07-29T12:00:00.000Z'),
  cover_image_url: null,
  credits: null,
  authors: null,
  author_keys: null,
  artists: null,
  publisher_name: null,
  publisher_key: null,
  scenario: null,
  creator_slug: null,
};

function makeDetailQuery(row: unknown) {
  const query = {
    leftJoin: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    executeTakeFirst: vi.fn().mockResolvedValue(row),
  };
  query.leftJoin.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.where.mockReturnValue(query);
  return query;
}

describe('consulta pública compartilhada de material', () => {
  beforeEach(() => mocks.selectFrom.mockReset());

  it('restringe simultaneamente ao slug e ao estado published', async () => {
    const query = makeDetailQuery(undefined);
    mocks.selectFrom.mockReturnValue(query);

    const result = await findPublishedMaterialBySlug('segredo');

    expect(result).toBeUndefined();
    const selections = query.select.mock.calls[0]?.[0] as unknown[];
    expect(selections).not.toContain('download_material.updated_at');
    const effectiveTimestamp = selections.at(-1) as { toOperationNode: () => unknown };
    const effectiveTimestampNode = JSON.stringify(effectiveTimestamp.toOperationNode());
    expect(effectiveTimestampNode).toContain('download_material_metadata');
    expect(effectiveTimestampNode).toContain('updated_at');
    expect(query.where).toHaveBeenNthCalledWith(1, 'download_material.slug', '=', 'segredo');
    expect(query.where).toHaveBeenNthCalledWith(2, 'download_material.editorial_state', '=', 'published');
    expect(query.executeTakeFirst).toHaveBeenCalledOnce();
  });

  it('rejeita valores persistidos que não cumprem o schema runtime completo', async () => {
    mocks.selectFrom.mockReturnValue(makeDetailQuery({
      ...VALID_PUBLIC_MATERIAL,
      authors: 'autor-em-string',
    }));

    await expect(findPublishedMaterialBySlug('material-publicado')).rejects.toMatchObject({
      name: 'ZodError',
    });
  });

  it('lista somente publicados em ordem de slug com timestamp efetivo', async () => {
    const rows = [
      { slug: 'aventura-a', updated_at: new Date('2026-07-29T12:00:00.000Z') },
    ];
    const query = {
      leftJoin: vi.fn(),
      select: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      execute: vi.fn().mockResolvedValue(rows),
    };
    query.leftJoin.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    mocks.selectFrom.mockReturnValue(query);

    await expect(listPublishedMaterialSlugs()).resolves.toEqual(rows);
    expect(query.where).toHaveBeenCalledWith('download_material.editorial_state', '=', 'published');
    expect(query.orderBy).toHaveBeenCalledWith('download_material.slug', 'asc');
  });
});
