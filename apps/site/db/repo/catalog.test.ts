import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { addAliases, replaceAliases, validateCatalogHierarchyShape } from './catalog';

describe('validateCatalogHierarchyShape', () => {
  it.each([
    ['system', null],
    ['edition', 'system'],
    ['variant', 'edition'],
  ] as const)('accepts %s under %s', (nodeType, parentType) => {
    expect(validateCatalogHierarchyShape(nodeType, parentType)).toBeNull();
  });

  it.each([
    ['system', 'system'],
    ['edition', null],
    ['edition', 'edition'],
    ['variant', null],
    ['variant', 'system'],
  ] as const)('rejects %s under %s', (nodeType, parentType) => {
    expect(validateCatalogHierarchyShape(nodeType, parentType)).not.toBeNull();
  });
});

// DEB-088-04 — `replaceAliases` (DELETE+INSERT) perdia alias quando duas
// aprovações de sugestão para o mesmo node rodavam concorrentes. Teste contra
// Postgres real porque a garantia é do banco (índice único + ON CONFLICT), não
// da lógica JS: um mock de query provaria só que a string SQL foi montada.
describe('addAliases — acréscimo atômico (DEB-088-04)', () => {
  async function seedNode(db: PGlite) {
    await db.exec(readFileSync(new URL('../migrations/006_catalog_foundation.sql', import.meta.url), 'utf8'));
    await db.query(
      `INSERT INTO catalog_nodes (id, node_type, canonical_slug, path_slug, name)
       VALUES ('dd5e', 'system', 'dnd-5e', 'dnd-5e', 'D&D 5e')`,
    );
    await db.query("INSERT INTO catalog_aliases (node_id, alias) VALUES ('dd5e', 'DnD')");
    // O repo chama `client.query(sql, values)`; PGlite expõe a mesma forma.
    return { query: (sql: string, values?: unknown[]) => db.query(sql, values) };
  }

  async function aliasesOf(db: PGlite): Promise<string[]> {
    const rows = (await db.query<{ alias: string }>("SELECT alias FROM catalog_aliases WHERE node_id='dd5e'")).rows;
    return rows.map((r) => r.alias).sort();
  }

  it('preserva os aliases existentes ao acrescentar', async () => {
    const db = new PGlite();
    try {
      const client = await seedNode(db);
      await addAliases(client as never, 'dd5e', ['Hint Novo'], 'admin-1');
      expect(await aliasesOf(db)).toEqual(['DnD', 'Hint Novo']);
    } finally {
      await db.close();
    }
  }, 20_000);

  it('dois acréscimos independentes preservam AMBOS — o caso que se perdia', async () => {
    const db = new PGlite();
    try {
      const client = await seedNode(db);
      // Cada aprovação enxerga o mesmo estado inicial. Com read-modify-write,
      // a segunda reenviava ['DnD','A'] sem saber de 'B' e apagava o alias da
      // primeira; aqui cada INSERT é independente e nada é apagado.
      await addAliases(client as never, 'dd5e', ['Alias A'], 'admin-1');
      await addAliases(client as never, 'dd5e', ['Alias B'], 'admin-2');
      expect(await aliasesOf(db)).toEqual(['Alias A', 'Alias B', 'DnD']);
    } finally {
      await db.close();
    }
  }, 20_000);

  it('alias repetido é no-op, inclusive com caixa diferente', async () => {
    const db = new PGlite();
    try {
      const client = await seedNode(db);
      // O índice único é sobre lower(alias) — 'dnd' colide com 'DnD'.
      await addAliases(client as never, 'dd5e', ['DnD', 'dnd'], 'admin-1');
      expect(await aliasesOf(db)).toEqual(['DnD']);
    } finally {
      await db.close();
    }
  }, 20_000);

  it('os dois campos são mutuamente exclusivos, alinhado com material types', async () => {
    // Aqui não daria erro de SQL (replaceAliases e addAliases são statements
    // separados), o que é pior que o caso de material type: passaria em
    // silêncio com uma semântica que ninguém especificou.
    const db = new PGlite();
    try {
      const client = await seedNode(db);
      await replaceAliases(client as never, 'dd5e', ['Só Este'], 'admin-1');
      await addAliases(client as never, 'dd5e', ['E Este'], 'admin-1');
      // Aplicados em sequência o resultado seria este — e é exatamente a
      // ambiguidade que updateCatalogNode agora rejeita com `aliases_conflict`
      // antes de chegar ao banco.
      expect(await aliasesOf(db)).toEqual(['E Este', 'Só Este']);
    } finally {
      await db.close();
    }
  }, 20_000);

  it('replaceAliases continua SUBSTITUINDO — os dois caminhos coexistem', async () => {
    const db = new PGlite();
    try {
      const client = await seedNode(db);
      // Edição admin deliberada ("a lista passa a ser esta") não pode virar
      // acréscimo, senão fica impossível remover um alias errado.
      await replaceAliases(client as never, 'dd5e', ['Só Este'], 'admin-1');
      expect(await aliasesOf(db)).toEqual(['Só Este']);
    } finally {
      await db.close();
    }
  }, 20_000);
});
