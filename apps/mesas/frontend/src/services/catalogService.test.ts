import { describe, expect, it } from 'vitest';
import { mapFiltersToQueryParams } from './catalogService';
import { makeCatalogFilters } from '../test/catalogFixtures';

describe('mapFiltersToQueryParams — contrato snake_case (R5/R6)', () => {
  it('sempre envia limit e page', () => {
    const params = mapFiltersToQueryParams(makeCatalogFilters());
    expect(params.get('limit')).toBe('24');
    expect(params.get('page')).toBe('1');
  });

  it('não envia parâmetros vazios', () => {
    const params = mapFiltersToQueryParams(makeCatalogFilters());
    expect(params.toString()).toBe('limit=24&page=1');
  });

  it('mapeia camelCase para snake_case', () => {
    const params = mapFiltersToQueryParams(
      makeCatalogFilters({
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
    const params = mapFiltersToQueryParams(makeCatalogFilters({ type: 'campanha' }));
    expect(params.get('type')).toBe('campanha');
  });

  it('omite type quando vazio', () => {
    const params = mapFiltersToQueryParams(makeCatalogFilters({ type: '' }));
    expect(params.has('type')).toBe(false);
  });

  it('nunca envia featured, audience, state ou city', () => {
    const full = makeCatalogFilters({
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
    const params = mapFiltersToQueryParams(makeCatalogFilters({ styles: ['b', 'a', 'b'] }));
    expect(params.get('styles')).toBe('a,b');
  });

  it('faz trim nos styles antes da query', () => {
    const params = mapFiltersToQueryParams(makeCatalogFilters({ styles: [' b ', 'a'] }));
    expect(params.get('styles')).toBe('a,b');
  });

  it('preserva vírgula pertencente ao nome de um estilo', () => {
    const params = mapFiltersToQueryParams(
      makeCatalogFilters({ styles: ['outro', ' investigação, horror '] }),
    );

    expect(params.get('styles')).toBe('investiga%C3%A7%C3%A3o%2C%20horror,outro');
    expect(params.toString()).toContain('styles=investiga%25C3%25A7%25C3%25A3o%252C%2520horror%2Coutro');
  });

  it('omite sort default (popular)', () => {
    const params = mapFiltersToQueryParams(makeCatalogFilters({ sort: 'popular' }));
    expect(params.has('sort')).toBe(false);
  });

  it('envia os sorts aprovados, incluindo slots', () => {
    for (const sort of ['popular', 'recent', 'slots', 'price_asc', 'price_desc'] as const) {
      const params = mapFiltersToQueryParams(makeCatalogFilters({ sort }));
      if (sort === 'popular') {
        expect(params.has('sort')).toBe(false);
      } else {
        expect(params.get('sort')).toBe(sort);
      }
    }
  });
});
