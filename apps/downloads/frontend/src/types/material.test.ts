import { describe, expect, it } from 'vitest';
import { materialSchema } from './material';

const materialFromApi = {
  id: 'material-1',
  slug: 'material-sem-metadata',
  title: 'Material sem metadata',
  summary: null,
  description: null,
  material_type: 'Aventura',
  access_kind: 'external_link' as const,
  external_url: 'https://example.com/material',
  creator_id: 'creator-1',
  editorial_state: 'published' as const,
  created_at: '2026-07-28T00:00:00.000Z',
  updated_at: '2026-07-28T00:00:00.000Z',
};

describe('materialSchema', () => {
  it('normaliza facetas nulas de material sem metadata para arrays vazios', () => {
    const parsed = materialSchema.parse({
      ...materialFromApi,
      authors: null,
      author_keys: null,
      artists: null,
    });

    expect(parsed.authors).toEqual([]);
    expect(parsed.author_keys).toEqual([]);
    expect(parsed.artists).toEqual([]);
  });

  it('normaliza facetas ausentes para arrays vazios', () => {
    const parsed = materialSchema.parse(materialFromApi);

    expect(parsed.authors).toEqual([]);
    expect(parsed.author_keys).toEqual([]);
    expect(parsed.artists).toEqual([]);
  });
});
