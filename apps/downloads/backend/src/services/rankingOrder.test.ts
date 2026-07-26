// Spec 087 (achado de review PR #214, Codex P2) — empate de score bayesiano e
// comum (poucas avaliacoes, metricas iguais). Sem desempate estavel, a ordem
// vinha do GROUP BY sem ORDER BY, que o Postgres nao garante consistente entre
// queries — e como a paginacao fatia esta lista, paginas diferentes podiam
// repetir ou omitir o mesmo material.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom },
}));

import { invalidateCatalogAnchorCache, loadRatingOrder } from './materialMetrics';

/**
 * Stub do builder: `executeTakeFirst` serve a ancora do catalogo, `execute`
 * devolve as linhas por material.
 */
function mockRows(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockReturnValue(builder);
  builder.groupBy = vi.fn().mockReturnValue(builder);
  builder.having = vi.fn().mockReturnValue(builder);
  builder.as = vi.fn().mockReturnValue(builder);
  builder.executeTakeFirst = vi.fn().mockResolvedValue({ catalog_mean: 4 });
  builder.execute = vi.fn().mockResolvedValue(rows);
  dbMocks.selectFrom.mockReturnValue(builder);
}

describe('ordem dos rankings — desempate determinístico', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    invalidateCatalogAnchorCache();
  });

  // Mesma nota e mesma contagem = mesmo score bayesiano. O criterio de
  // desempate e o id, entao a ordem e previsivel independente do que o banco
  // devolveu.
  it('desempata por materialId quando o score é idêntico', async () => {
    mockRows([
      { material_id: 'm-zebra', item_mean: 4, item_count: 3 },
      { material_id: 'm-alfa', item_mean: 4, item_count: 3 },
      { material_id: 'm-meio', item_mean: 4, item_count: 3 },
    ]);

    await expect(loadRatingOrder()).resolves.toEqual(['m-alfa', 'm-meio', 'm-zebra']);
  });

  // O desempate nao pode atropelar o criterio principal: score maior vem antes,
  // mesmo com id "maior".
  it('score maior continua vindo antes, independente do id', async () => {
    mockRows([
      { material_id: 'm-alfa', item_mean: 1, item_count: 10 },
      { material_id: 'm-zebra', item_mean: 5, item_count: 10 },
    ]);

    await expect(loadRatingOrder()).resolves.toEqual(['m-zebra', 'm-alfa']);
  });

  // O ponto do achado: a ordem tem que ser a MESMA mesmo quando o banco devolve
  // as linhas noutra ordem, senao pagina 1 e pagina 2 discordam.
  it('produz a mesma ordem quando o banco devolve as linhas embaralhadas', async () => {
    mockRows([
      { material_id: 'm-b', item_mean: 4, item_count: 3 },
      { material_id: 'm-a', item_mean: 4, item_count: 3 },
    ]);
    const first = await loadRatingOrder();

    invalidateCatalogAnchorCache();
    mockRows([
      { material_id: 'm-a', item_mean: 4, item_count: 3 },
      { material_id: 'm-b', item_mean: 4, item_count: 3 },
    ]);
    const second = await loadRatingOrder();

    expect(second).toEqual(first);
  });
});
