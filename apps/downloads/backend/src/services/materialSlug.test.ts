import {
  MAX_MATERIAL_SLUG_LENGTH,
  MaterialSlugExhaustedError,
  appendMaterialSlugSuffix,
  createWithUniqueMaterialSlug,
  slugifyMaterialTitle,
} from './materialSlug';

describe('materialSlug', () => {
  it.each([
    ['Aventuras em São Luís', 'aventuras-em-sao-luis'],
    ['  D&D: 5ª Edição!  ', 'd-d-5a-edicao'],
    ['🔥 漢字', 'material'],
  ])('normaliza %s', (title, expected) => {
    expect(slugifyMaterialTitle(title)).toBe(expected);
  });

  it('respeita o limite do banco inclusive com sufixo', () => {
    const base = slugifyMaterialTitle('a'.repeat(300));
    const suffixed = appendMaterialSlugSuffix(base, '12345678');

    expect(base).toHaveLength(MAX_MATERIAL_SLUG_LENGTH);
    expect(suffixed).toHaveLength(MAX_MATERIAL_SLUG_LENGTH);
    expect(suffixed).toMatch(/-12345678$/);
  });

  it('resolve criações concorrentes pelo índice UNIQUE', async () => {
    const slugs = new Set<string>();
    const insert = async (slug: string) => {
      await Promise.resolve();
      if (slugs.has(slug)) {
        throw { code: '23505', constraint: 'idx_download_material_slug' };
      }
      slugs.add(slug);
      return slug;
    };

    const created = await Promise.all([
      createWithUniqueMaterialSlug('Mesmo título', insert),
      createWithUniqueMaterialSlug('Mesmo título', insert),
    ]);

    expect(new Set(created)).toEqual(new Set(['mesmo-titulo', 'mesmo-titulo-2']));
  });

  it('não mascara erro de outro índice ou falha do banco', async () => {
    const error = { code: '23505', constraint: 'outro_indice' };
    await expect(createWithUniqueMaterialSlug('Título', async () => Promise.reject(error)))
      .rejects.toBe(error);
  });

  it('falha explicitamente depois de esgotar todas as colisões possíveis', async () => {
    const insert = vi.fn().mockRejectedValue({
      code: '23505',
      constraint: 'idx_download_material_slug',
    });

    await expect(createWithUniqueMaterialSlug('Título sempre repetido', insert))
      .rejects.toBeInstanceOf(MaterialSlugExhaustedError);
    expect(insert).toHaveBeenCalledTimes(50);
  });
});
