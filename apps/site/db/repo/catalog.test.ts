import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// `updateNode` resolve a conexão por `getDb()`, não recebe client por
// parâmetro. Para exercitar o caminho real (BEGIN/ROLLBACK incluídos) o mock
// devolve o PGlite do teste corrente, guardado em `activeDb`.
let activeDb: PGlite | null = null;
vi.mock('../connection.js', () => ({
  getDb: async () => ({
    query: (sql: string, values?: unknown[]) => activeDb!.query(sql, values),
    getClient: async () => ({
      query: (sql: string, values?: unknown[]) => activeDb!.query(sql, values),
      release: () => {},
    }),
  }),
}));

import { addAliases, createNode, replaceAliases, updateNode, validateCatalogHierarchyShape } from './catalog';

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

  // Achado real (review PR #218, CodeRabbit, 2ª passada): a versão anterior
  // deste teste chamava `replaceAliases` e `addAliases` em SEQUÊNCIA e
  // asseverava o resultado combinado — ou seja, testava exatamente o caminho
  // que `updateCatalogNode` passou a proibir, sem nunca exercitar a proibição.
  // Agora chama `updateCatalogNode` com os dois campos e prova as duas coisas
  // que importam: rejeita com `aliases_conflict`, e o banco fica INTACTO
  // (rollback), sem o `replaceAliases` ter apagado nada antes do erro.
  it('updateNode rejeita aliases + add_aliases e faz rollback', async () => {
    const db = new PGlite();
    activeDb = db;
    try {
      await seedNode(db);
      const antes = await aliasesOf(db);

      await expect(
        updateNode('dd5e', { node_type: 'system', name: 'D&D 5e', aliases: ['Substituto'], add_aliases: ['Extra'] }, 'admin-1'),
      ).rejects.toThrow('aliases_conflict');

      // Sem o guard, `replaceAliases` rodaria primeiro e o DELETE já teria
      // apagado 'DnD' — o rollback é o que garante que uma requisição inválida
      // não destrói vocabulário pelo caminho.
      expect(await aliasesOf(db)).toEqual(antes);
      expect(await aliasesOf(db)).toEqual(['DnD']);
    } finally {
      activeDb = null;
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

/**
 * F6.3d (spec 100) — a guarda que impede a sétima tentativa.
 *
 * O catálogo de beta ganhou DUAS edições "5e" irmãs sob `Dungeons & Dragons`,
 * cada uma com sua linhagem paralela de variantes, porque a única defesa contra
 * duplicata era a UNIQUE de `path_slug` — e `2024` e `Dungeons & Dragons 2024`
 * têm slugs diferentes. Consequência medida: `parseDiscordAnnouncement`
 * resolvendo `D&D 5e 2024` PARA NA RAIZ, porque não há resposta certa com dois
 * irmãos empatados. Seis tentativas anteriores atacaram a resolução; a fábrica
 * é o `createNode`.
 *
 * Contra Postgres real, como os vizinhos: a guarda lê irmãos e aliases do banco.
 */
describe('createNode — irmão semanticamente equivalente (spec 100 F6.3d)', () => {
  async function seedArvore(db: PGlite) {
    await db.exec(readFileSync(new URL('../migrations/006_catalog_foundation.sql', import.meta.url), 'utf8'));
    await db.query(
      `INSERT INTO catalog_nodes (id, node_type, canonical_slug, path_slug, name)
       VALUES ('dd', 'system', 'dungeons-dragons', 'dungeons-dragons', 'Dungeons & Dragons')`,
    );
    await db.query(
      `INSERT INTO catalog_nodes (id, parent_id, node_type, canonical_slug, path_slug, name)
       VALUES ('dd5e', 'dd', 'edition', '5e', 'dungeons-dragons/5e', '5e')`,
    );
  }

  const edicao = (name: string, aliases: string[] = []) => ({
    parent_id: 'dd',
    node_type: 'edition' as const,
    name,
    name_pt: null,
    description: null,
    official_website_url: null,
    logo_media_id: null,
    aliases,
  });

  it('recusa a segunda edição "5e" sob o mesmo pai', async () => {
    const db = new PGlite();
    activeDb = db;
    try {
      await seedArvore(db);
      await expect(createNode(edicao('5e'), 'admin-1')).rejects.toThrow('duplicate_sibling_node');
    } finally {
      activeDb = null;
      await db.close();
    }
  }, 20_000);

  it('recusa o irmão que só difere pelo nome do pai no começo — o caso que passou pelo path_slug', async () => {
    const db = new PGlite();
    activeDb = db;
    try {
      await seedArvore(db);
      // Slug distinto (`dungeons-dragons-5e` ≠ `5e`), logo a UNIQUE deixaria
      // passar. É exatamente como nasceu a segunda linhagem em beta.
      await expect(createNode(edicao('Dungeons & Dragons 5e'), 'admin-1')).rejects.toThrow(
        'duplicate_sibling_node',
      );
    } finally {
      activeDb = null;
      await db.close();
    }
  }, 20_000);

  it('recusa quando a colisão está num APELIDO do nó existente', async () => {
    const db = new PGlite();
    activeDb = db;
    try {
      await seedArvore(db);
      await db.query("INSERT INTO catalog_aliases (node_id, alias) VALUES ('dd5e', 'Quinta Edição')");
      await expect(createNode(edicao('quinta edicao'), 'admin-1')).rejects.toThrow(
        'duplicate_sibling_node',
      );
    } finally {
      activeDb = null;
      await db.close();
    }
  }, 20_000);

  it('deixa passar irmão de fato diferente', async () => {
    const db = new PGlite();
    activeDb = db;
    try {
      await seedArvore(db);
      const row = await createNode(edicao('4e'), 'admin-1');
      expect(row.name).toBe('4e');
    } finally {
      activeDb = null;
      await db.close();
    }
  }, 20_000);

  it('o mesmo nome sob OUTRO pai continua válido — "5e" existe em vários sistemas', async () => {
    const db = new PGlite();
    activeDb = db;
    try {
      await seedArvore(db);
      await db.query(
        `INSERT INTO catalog_nodes (id, node_type, canonical_slug, path_slug, name)
         VALUES ('vamp', 'system', 'vampiro', 'vampiro', 'Vampiro')`,
      );
      const row = await createNode({ ...edicao('5e'), parent_id: 'vamp' }, 'admin-1');
      expect(row.parent_id).toBe('vamp');
    } finally {
      activeDb = null;
      await db.close();
    }
  }, 20_000);
});
