import { describe, expect, it } from 'vitest';
import { mapFiltersToQueryParams, type CatalogFilters } from './catalogService';

function makeFilters(overrides: Partial<CatalogFilters> = {}): CatalogFilters {
  return {
    search: '',
    system: '',
    modality: '',
    priceType: '',
    experience: '',
    seal: '',
    styles: [],
    type: '',
    sort: 'popular',
    page: 1,
    limit: 24,
    ...overrides,
  };
}

describe('mapFiltersToQueryParams — contrato snake_case (R5/R6)', () => {
  it('sempre envia limit e page', () => {
    const params = mapFiltersToQueryParams(makeFilters());
    expect(params.get('limit')).toBe('24');
    expect(params.get('page')).toBe('1');
  });

  it('não envia parâmetros vazios', () => {
    const params = mapFiltersToQueryParams(makeFilters());
    expect(params.toString()).toBe('limit=24&page=1');
  });

  it('mapeia camelCase para snake_case', () => {
    const params = mapFiltersToQueryParams(
      makeFilters({
        search: 'vampiro',
        system: 'vampire-a-mascara',
        modality: 'online',
        priceType: 'paga',
        experience: 'veterano',
        seal: 'ddal',
        sort: 'price_asc',
      })
    );

    expect(params.get('search')).toBe('vampiro');
    expect(params.get('system')).toBe('vampire-a-mascara');
    expect(params.get('modality')).toBe('online');
    expect(params.get('price_type')).toBe('paga');
    expect(params.get('experience_level')).toBe('veterano');
    expect(params.get('seal')).toBe('ddal');
    expect(params.get('sort')).toBe('price_asc');
  });

  it('mapeia a faceta type habilitada por T0.2a', () => {
    const params = mapFiltersToQueryParams(makeFilters({ type: 'campanha' }));
    expect(params.get('type')).toBe('campanha');
  });

  it('omite type quando vazio', () => {
    const params = mapFiltersToQueryParams(makeFilters({ type: '' }));
    expect(params.has('type')).toBe(false);
  });

  it('nunca envia featured, audience, state ou city', () => {
    const full = makeFilters({
      search: 'x',
      system: 'dnd-5e',
      modality: 'online',
      priceType: 'paga',
      experience: 'veterano',
      seal: 'ddal',
      styles: ['a', 'b'],
      type: 'campanha',
      sort: 'slots',
      page: 2,
    });
    const params = mapFiltersToQueryParams(full);
    const serialized = params.toString();

    expect(serialized).not.toContain('featured');
    expect(serialized).not.toContain('audience');
    expect(serialized).not.toContain('state');
    expect(serialized).not.toContain('city');
  });

  it('ordena e deduplica styles na cache key (R11)', () => {
    const params = mapFiltersToQueryParams(makeFilters({ styles: ['b', 'a', 'b'] }));
    expect(params.get('styles')).toBe('a,b');
  });

  it('faz trim nos styles antes da query', () => {
    const params = mapFiltersToQueryParams(makeFilters({ styles: [' b ', 'a'] }));
    expect(params.get('styles')).toBe('a,b');
  });

  it('omite sort default (popular)', () => {
    const params = mapFiltersToQueryParams(makeFilters({ sort: 'popular' }));
    expect(params.has('sort')).toBe(false);
  });

  it('envia os sorts aprovados, incluindo slots', () => {
    for (const sort of ['popular', 'recent', 'slots', 'price_asc', 'price_desc'] as const) {
      const params = mapFiltersToQueryParams(makeFilters({ sort }));
      if (sort === 'popular') {
        expect(params.has('sort')).toBe(false);
      } else {
        expect(params.get('sort')).toBe(sort);
      }
    }
  });
});
