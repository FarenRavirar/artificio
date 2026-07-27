import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const dbQueryMock = vi.hoisted(() => vi.fn());
vi.mock('../connection.js', () => ({
  getDb: async () => ({ query: dbQueryMock }),
}));

import { normalizeMaterialTypeWrite, slugifyMaterialType, updateMaterialType } from './materialTypes';

// `dbQueryMock` é criado uma vez por arquivo, então `mock.calls[0]` sem reset
// devolveria a chamada do PRIMEIRO teste que gravou, não a do teste corrente.
beforeEach(() => {
  dbQueryMock.mockReset();
});

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

  it('atualiza só campos explicitamente enviados no patch', async () => {
    dbQueryMock.mockResolvedValueOnce({ rows: [{
      id: 'type-1', slug: 'aventura', name: 'Novo nome', aliases: [], status: 'active',
      created_at: '2026-07-25', updated_at: '2026-07-25',
    }] });

    await updateMaterialType('type-1', { name: ' Novo nome ' }, 'actor-1');

    const [sql, values] = dbQueryMock.mock.calls[0];
    expect(sql.split(' WHERE')[0]).toContain('SET name=$1, updated_by=$2, updated_at=now()');
    expect(sql.split(' WHERE')[0]).not.toContain('slug=');
    expect(sql.split(' WHERE')[0]).not.toContain('aliases=');
    expect(sql.split(' WHERE')[0]).not.toContain('status=');
    expect(values).toEqual(['Novo nome', 'actor-1', 'type-1']);
  });
});

// Achado real (review PR #218, Codex, P2): `aliases` SUBSTITUI a lista, e quem
// só quer acrescentar tinha de ler/concatenar/reenviar. Duas aprovações
// simultâneas de sugestão para o mesmo tipo perdiam um dos aliases.
describe('add_aliases — acréscimo atômico', () => {
  it('concatena dentro do UPDATE, sem ler a lista antes', async () => {
    dbQueryMock.mockResolvedValueOnce({ rows: [{
      id: 'type-1', slug: 'suplemento', name: 'Suplemento', aliases: ['supplement', 'novo'], status: 'active',
      created_at: '2026-07-27', updated_at: '2026-07-27',
    }] });

    await updateMaterialType('type-1', { add_aliases: ['novo'] }, 'actor-1');

    const [sql, values] = dbQueryMock.mock.calls[0];
    // A leitura de `aliases` acontece DENTRO do statement — é isso que fecha a
    // janela entre ler e escrever. Substituição direta seria `aliases=$1`.
    expect(sql).toContain('jsonb_array_elements(aliases ||');
    expect(sql).not.toMatch(/aliases=\$\d+::jsonb/);
    expect(values).toEqual([JSON.stringify(['novo']), 'actor-1', 'type-1']);
  });

  it('lista vazia não gera atribuição alguma', async () => {
    dbQueryMock.mockResolvedValueOnce({ rows: [{
      id: 'type-1', slug: 's', name: 'S', aliases: [], status: 'active',
      created_at: '2026-07-27', updated_at: '2026-07-27',
    }] });

    await updateMaterialType('type-1', { add_aliases: [] }, 'actor-1');

    const [sql] = dbQueryMock.mock.calls[0];
    expect(sql).not.toContain('jsonb_array_elements');
  });

  it('SQL real: dois acréscimos concorrentes preservam AMBOS os aliases', async () => {
    const db = new PGlite();
    try {
      await db.exec(readFileSync(new URL('../migrations/015_catalog_material_types.sql', import.meta.url), 'utf8'));

      const addAlias = `UPDATE catalog_material_types SET aliases=(
        SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
        FROM jsonb_array_elements(aliases || $1::jsonb)
      ) WHERE id='b071ab5e-2d16-4c58-8f0e-086000000001'`;

      // É este o cenário que o read-modify-write perdia: cada aprovação lia a
      // mesma lista base e a última gravação apagava o alias da primeira.
      await db.query(addAlias, [JSON.stringify(['modulo'])]);
      await db.query(addAlias, [JSON.stringify(['cenario-solo'])]);

      const result = await db.query<{ aliases: string[] }>(
        "SELECT aliases FROM catalog_material_types WHERE slug='aventura'",
      );
      expect([...result.rows[0]!.aliases].sort()).toEqual(['adventure', 'aventuras', 'cenario-solo', 'modulo']);
    } finally {
      await db.close();
    }
  }, 15_000);

  it('SQL real: alias repetido não duplica', async () => {
    const db = new PGlite();
    try {
      await db.exec(readFileSync(new URL('../migrations/015_catalog_material_types.sql', import.meta.url), 'utf8'));

      const addAlias = `UPDATE catalog_material_types SET aliases=(
        SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
        FROM jsonb_array_elements(aliases || $1::jsonb)
      ) WHERE slug='aventura'`;

      await db.query(addAlias, [JSON.stringify(['adventure'])]);

      const result = await db.query<{ aliases: string[] }>(
        "SELECT aliases FROM catalog_material_types WHERE slug='aventura'",
      );
      expect([...result.rows[0]!.aliases].sort()).toEqual(['adventure', 'aventuras']);
    } finally {
      await db.close();
    }
  }, 15_000);
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
