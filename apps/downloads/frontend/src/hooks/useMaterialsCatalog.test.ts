import { buildQueryString } from './useMaterialsCatalog';

describe('buildQueryString', () => {
  it('serializa facetas de editora e autoria sem herdar filtros ausentes', () => {
    expect(buildQueryString({ publisher: 'grimorios e dados', author: 'agata', page: 1 }))
      .toBe('publisher=grimorios+e+dados&author=agata&page=1');
  });
});
