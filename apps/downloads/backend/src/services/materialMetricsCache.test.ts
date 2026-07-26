// Spec 087 (achado de review PR #214, CodeRabbit) — as ancoras de catalogo
// (o `C` do Bayesian average) eram recalculadas a cada request, e a de
// popularidade duas vezes no mesmo request de `sort=trending`. Esta suite cobre
// o cache que consolidou as duas.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom },
}));

import {
  invalidateCatalogAnchorCache,
  loadRatingAggregates,
  loadRatingOrder,
} from './materialMetrics';

/**
 * Stub minimo do builder do Kysely. `executeTakeFirst` responde a consulta da
 * ancora (media do catalogo); `execute` responde a consulta por material.
 */
function mockBuilder(catalogMean: number, rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockReturnValue(builder);
  builder.groupBy = vi.fn().mockReturnValue(builder);
  builder.having = vi.fn().mockReturnValue(builder);
  builder.as = vi.fn().mockReturnValue(builder);
  builder.executeTakeFirst = vi.fn().mockResolvedValue({ catalog_mean: catalogMean });
  builder.execute = vi.fn().mockResolvedValue(rows);
  return builder;
}

describe('cache da âncora de catálogo', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    // Cache e estado de modulo: sem zerar, um teste herdaria a ancora do outro.
    invalidateCatalogAnchorCache();
  });

  it('não repete a consulta da âncora entre chamadas seguidas', async () => {
    dbMocks.selectFrom.mockImplementation(() => mockBuilder(4, [
      { material_id: 'm1', item_mean: 5, item_count: 2 },
    ]));

    await loadRatingAggregates(['m1']);
    const afterFirst = dbMocks.selectFrom.mock.calls.length;

    // `sort=rating` chama as duas no mesmo request; a segunda nao pode pagar a
    // ancora de novo.
    await loadRatingOrder();
    const afterSecond = dbMocks.selectFrom.mock.calls.length;

    // A segunda chamada faz apenas a consulta POR MATERIAL (1), nunca a da
    // ancora — se a ancora tivesse rodado de novo, seriam 2.
    expect(afterSecond - afterFirst).toBe(1);
  });

  it('volta a consultar a âncora depois de invalidada', async () => {
    dbMocks.selectFrom.mockImplementation(() => mockBuilder(4, []));

    await loadRatingOrder();
    const afterFirst = dbMocks.selectFrom.mock.calls.length;

    invalidateCatalogAnchorCache();
    await loadRatingOrder();

    expect(dbMocks.selectFrom.mock.calls.length).toBeGreaterThan(afterFirst + 1);
  });

  // O cache nao pode mudar o resultado: mesma ancora, mesmo score.
  it('preserva o score calculado com a âncora cacheada', async () => {
    dbMocks.selectFrom.mockImplementation(() => mockBuilder(4, [
      { material_id: 'm1', item_mean: 5, item_count: 5 },
    ]));

    const first = await loadRatingAggregates(['m1']);
    const second = await loadRatingAggregates(['m1']);

    expect(second.get('m1')).toEqual(first.get('m1'));
    // WR = (5/(5+5))*5 + (5/(5+5))*4 = 4.5 — ancora 4, m=5.
    expect(first.get('m1')?.avgRating).toBeCloseTo(4.5, 5);
  });
});
