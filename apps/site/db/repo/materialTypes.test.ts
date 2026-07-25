import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { normalizeMaterialTypeWrite, slugifyMaterialType } from './materialTypes';

describe('material type vocabulary', () => {
  it('gera slug estável e normaliza aliases duplicados', () => {
    expect(slugifyMaterialType('  Aventuras & Cenários  ')).toBe('aventuras-cenarios');
    expect(normalizeMaterialTypeWrite({
      name: ' Aventura ',
      aliases: ['adventure', ' adventure ', '', 'aventuras'],
    })).toEqual({
      name: 'Aventura',
      slug: 'aventura',
      aliases: ['adventure', 'aventuras'],
      status: 'active',
    });
  });

  it('rejeita nome, slug e status inválidos', () => {
    expect(() => normalizeMaterialTypeWrite({ name: ' ' })).toThrow('name_required');
    expect(() => normalizeMaterialTypeWrite({ name: '---' })).toThrow('slug_required');
    expect(() => normalizeMaterialTypeWrite({ name: 'Aventura', status: 'x' as never })).toThrow('bad_status');
  });
});

describe('015_catalog_material_types.sql', () => {
  it('executa duas vezes e mantém seed canônico', async () => {
    const db = new PGlite();
    try {
      const sql = readFileSync(new URL('../migrations/015_catalog_material_types.sql', import.meta.url), 'utf8');
      await db.exec(sql);
      await db.exec(sql);

      const result = await db.query<{ id: string; slug: string; name: string }>(
        'SELECT id::text AS id, slug, name FROM catalog_material_types',
      );
      expect(result.rows).toEqual([{
        id: 'b071ab5e-2d16-4c58-8f0e-086000000001',
        slug: 'aventura',
        name: 'Aventura',
      }]);
    } finally {
      await db.close();
    }
  }, 15_000);
});
