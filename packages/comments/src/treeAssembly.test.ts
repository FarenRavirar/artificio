import { describe, expect, it } from 'vitest';
import {
  MAX_COMMENTS_PER_READ,
  assembleTree,
  type AssemblyRow,
} from './treeAssembly.js';

function row(
  id: string,
  parent_id: string | null,
  depth: number,
  size_bytes = 100,
): AssemblyRow {
  return { id, parent_id, depth, size_bytes, sort_key: `k-${id}` };
}

/** Raiz com `childCount` filhos diretos, no formato que a query entrega. */
function branch(rootId: string, childCount: number, size = 100): AssemblyRow[] {
  const rows: AssemblyRow[] = [row(rootId, null, 0, size)];
  for (let i = 0; i < childCount; i += 1) {
    rows.push(row(`${rootId}-c${i}`, rootId, 1, size));
  }
  return rows;
}

describe('assembleTree', () => {
  it('volume normal devolve a arvore inteira, sem more', () => {
    const rows = [...branch('r1', 3), ...branch('r2', 2)];
    const result = assembleTree({ rows, sort: 'best' });

    expect(result.included).toHaveLength(7);
    expect(result.more).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('preserva a ordem de leitura entregue pela query', () => {
    const rows = [...branch('r1', 2), ...branch('r2', 1)];
    const result = assembleTree({ rows, sort: 'best' });

    expect(result.included).toEqual(['r1', 'r1-c0', 'r1-c1', 'r2', 'r2-c0']);
  });

  it('aninhamento profundo entra junto do ramo', () => {
    const rows = [
      row('r1', null, 0),
      row('a', 'r1', 1),
      row('b', 'a', 2),
      row('c', 'b', 3),
      row('d', 'c', 4),
    ];
    const result = assembleTree({ rows, sort: 'best' });

    expect(result.included).toEqual(['r1', 'a', 'b', 'c', 'd']);
    expect(result.truncated).toBe(false);
  });

  // T2.3 · feito quando: "arvore de 1.500 comentarios devolve `more` sem orfao".
  it('1.500 comentarios cortam no teto e devolvem more sem orfao', () => {
    const rows: AssemblyRow[] = [];
    for (let i = 0; i < 150; i += 1) rows.push(...branch(`r${i}`, 9)); // 150 * 10

    expect(rows).toHaveLength(1500);

    const result = assembleTree({ rows, sort: 'best' });

    expect(result.truncated).toBe(true);
    expect(result.more).toHaveLength(1);
    expect(result.included.length).toBeLessThanOrEqual(MAX_COMMENTS_PER_READ);

    // Invariante central: todo filho servido tem o pai servido.
    const servido = new Set(result.included);
    const paiDe = new Map(rows.map((r) => [r.id, r.parent_id]));
    for (const id of result.included) {
      const pai = paiDe.get(id);
      if (pai !== null && pai !== undefined) expect(servido.has(pai)).toBe(true);
    }

    // Nada se perde: servidos + adiados = total.
    expect(result.included.length + result.more[0].count).toBe(1500);
  });

  it('ramo nunca entra pela metade', () => {
    // Teto 25 com ramos de 10: cabem 2 ramos (20), o terceiro e adiado inteiro.
    const rows = [...branch('r1', 9), ...branch('r2', 9), ...branch('r3', 9)];
    const result = assembleTree({ rows, sort: 'best', maxComments: 25 });

    expect(result.included).toHaveLength(20);
    expect(result.included).toContain('r2-c8');
    expect(result.included).not.toContain('r3');
    expect(result.more[0].count).toBe(10);
  });

  it('teto de bytes corta como o de contagem', () => {
    const rows = [...branch('r1', 1, 600), ...branch('r2', 1, 600)];
    const result = assembleTree({ rows, sort: 'best', maxBytes: 1500 });

    expect(result.included).toEqual(['r1', 'r1-c0']);
    expect(result.truncated).toBe(true);
    expect(result.more[0].count).toBe(2);
  });

  // Decisao 3: "uma thread nao pode consumir memoria sem teto no `accounts.`,
  // que tambem sustenta o SSO". Servir a raiz gigante inteira derrubaria o
  // login de todos os apps por causa de uma thread — o teto e rigido.
  it('primeiro ramo maior que o teto e truncado, nao servido inteiro', () => {
    const rows = branch('r1', 50);
    const result = assembleTree({ rows, sort: 'best', maxComments: 10 });

    expect(result.included).toHaveLength(10);
    expect(result.truncated).toBe(true);

    // `more` do proprio ramo, para a expansao saber onde retomar.
    expect(result.more).toEqual([
      { parent_id: 'r1', count: 41, after: 'k-r1-c8' },
    ]);
  });

  it('ramo truncado nunca orfana: o pai vem antes de todo descendente', () => {
    const rows = [
      row('r1', null, 0),
      row('a', 'r1', 1),
      row('b', 'a', 2),
      row('c', 'b', 3),
    ];
    const result = assembleTree({ rows, sort: 'best', maxComments: 2 });

    expect(result.included).toEqual(['r1', 'a']);

    const servido = new Set(result.included);
    const paiDe = new Map(rows.map((r) => [r.id, r.parent_id]));
    for (const id of result.included) {
      const pai = paiDe.get(id);
      if (pai !== null && pai !== undefined) expect(servido.has(pai)).toBe(true);
    }
  });

  it('primeiro ramo estoura o teto de bytes e trunca', () => {
    const rows = branch('r1', 5, 400);
    const result = assembleTree({ rows, sort: 'best', maxBytes: 1000 });

    expect(result.included).toEqual(['r1', 'r1-c0']);
    expect(result.more[0].parent_id).toBe('r1');
    expect(result.more[0].count).toBe(4);
  });

  it('depois do corte nenhum ramo posterior fura a fila', () => {
    // r2 e grande, r3 e pequeno: r3 nao pode passar na frente de r2.
    const rows = [...branch('r1', 1), ...branch('r2', 20), ...branch('r3', 0)];
    const result = assembleTree({ rows, sort: 'best', maxComments: 5 });

    expect(result.included).toEqual(['r1', 'r1-c0']);
    expect(result.included).not.toContain('r3');
    expect(result.more[0].count).toBe(22);
  });

  // Pai ausente significa recorte da query, nao raiz nova.
  it('descarta filho cujo pai nao veio, em vez de promover a raiz', () => {
    const rows = [row('r1', null, 0), row('orfao', 'inexistente', 1)];
    const result = assembleTree({ rows, sort: 'best' });

    expect(result.included).toEqual(['r1']);
  });

  it('more de continuacao aponta a sort-key da ultima raiz servida', () => {
    const rows = [...branch('r1', 1), ...branch('r2', 1), ...branch('r3', 1)];
    const result = assembleTree({ rows, sort: 'best', maxComments: 4 });

    expect(result.more[0]).toEqual({ parent_id: null, count: 2, after: 'k-r2' });
  });

  it('lista vazia nao produz more', () => {
    const result = assembleTree({ rows: [], sort: 'best' });

    expect(result).toEqual({ included: [], more: [], truncated: false });
  });

  it('ramos adiados viram um unico more agregado', () => {
    const rows = [...branch('r1', 0), ...branch('r2', 0), ...branch('r3', 0)];
    const result = assembleTree({ rows, sort: 'best', maxComments: 1 });

    expect(result.more).toHaveLength(1);
    expect(result.more[0].count).toBe(2);
  });

  // Achado de review da PR #245: quando o PRIMEIRO ramo era truncado,
  // `lastServedRootSortKey` nunca era atribuido e os ramos posteriores saiam
  // com `after: ''`. String vazia e menor que qualquer sort_key, entao o banco
  // a le como "desde o comeco" — a continuacao devolveria a arvore inteira de
  // novo, duplicando tudo que ja tinha sido servido.
  describe('primeiro ramo truncado seguido de ramos posteriores', () => {
    it('more da continuacao aponta para a raiz truncada, nunca vazio', () => {
      const rows = [...branch('r1', 5), ...branch('r2', 0), ...branch('r3', 0)];
      const result = assembleTree({ rows, sort: 'best', maxComments: 3 });

      const rootMore = result.more.find((node) => node.parent_id === null);
      expect(rootMore).toBeDefined();
      expect(rootMore?.after).toBe('k-r1');
      expect(rootMore?.after).not.toBe('');
      expect(rootMore?.count).toBe(2);
    });

    it('more do proprio ramo truncado retoma do ultimo item servido', () => {
      const rows = [...branch('r1', 5), ...branch('r2', 0)];
      const result = assembleTree({ rows, sort: 'best', maxComments: 3 });

      const branchMore = result.more.find((node) => node.parent_id === 'r1');
      expect(branchMore).toEqual({
        parent_id: 'r1',
        count: 3,
        after: 'k-r1-c1',
      });
    });

    it('nenhum more sai com after vazio', () => {
      const rows = [...branch('r1', 9), ...branch('r2', 2), ...branch('r3', 2)];
      const result = assembleTree({ rows, sort: 'best', maxComments: 4 });

      expect(result.more.length).toBeGreaterThan(0);
      for (const node of result.more) {
        expect(node.after).not.toBe('');
      }
    });

    it('servidos mais adiados fecham o total, sem perder nem duplicar', () => {
      const rows = [...branch('r1', 5), ...branch('r2', 1), ...branch('r3', 1)];
      const result = assembleTree({ rows, sort: 'best', maxComments: 3 });

      const adiados = result.more.reduce((total, node) => total + node.count, 0);
      expect(result.included.length + adiados).toBe(rows.length);
      expect(new Set(result.included).size).toBe(result.included.length);
    });
  });
});
