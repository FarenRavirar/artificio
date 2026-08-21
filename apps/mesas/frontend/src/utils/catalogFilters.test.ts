import { describe, expect, it } from 'vitest';
import { buildCatalogParams, parseCatalogFilters } from './catalogFilters';
import { SORT_VALUES, TABLE_TYPE_VALUES } from './catalogFilterOptions';
import { makeCatalogFilters } from '../test/catalogFixtures';

describe('parseCatalogFilters — defaults', () => {
  it('URL vazia produz o estado default completo', () => {
    expect(parseCatalogFilters(new URLSearchParams())).toEqual({
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
    });
  });

  it('normaliza page inválida/zero para 1', () => {
    expect(parseCatalogFilters(new URLSearchParams('page=abc')).page).toBe(1);
    expect(parseCatalogFilters(new URLSearchParams('page=0')).page).toBe(1);
    expect(parseCatalogFilters(new URLSearchParams('page=-3')).page).toBe(1);
    expect(parseCatalogFilters(new URLSearchParams('page=4')).page).toBe(4);
  });
});

describe('parseCatalogFilters — enums e round-trip', () => {
  it.each(SORT_VALUES)('aceita sort %s', (sort) => {
    const parsed = parseCatalogFilters(new URLSearchParams(`sort=${sort}`));
    expect(parsed.sort).toBe(sort);
  });

  it.each(['modality', 'price_type', 'experience_level'])('valida %s contra a fonte única', (param) => {
    expect(parseCatalogFilters(new URLSearchParams(`${param}=invalido`))).toMatchObject(
      param === 'modality'
        ? { modality: '' }
        : param === 'price_type'
          ? { priceType: '' }
          : { experience: '' }
    );
  });

  it('valores válidos de modalidade, preço e experiência sobrevivem ao parse', () => {
    const parsed = parseCatalogFilters(
      new URLSearchParams('modality=online&price_type=paga&experience_level=veterano')
    );
    expect(parsed).toMatchObject({
      modality: 'online',
      priceType: 'paga',
      experience: 'veterano',
    });
  });

  it('faz round-trip: estado → URL → mesmo estado', () => {
    const filters = makeCatalogFilters({
      search: 'vampiro',
      system: 'vampire-a-mascara',
      modality: 'online',
      priceType: 'paga',
      experience: 'intermediario',
      seal: 'ddal',
      styles: ['narrativista', 'terror'],
      type: 'campanha',
      sort: 'slots',
      page: 3,
    });

    const roundTripped = parseCatalogFilters(buildCatalogParams(filters));

    expect(roundTripped).toEqual(filters);
  });
});

describe('parseCatalogFilters — type (faceta habilitada por T0.2a)', () => {
  it.each(TABLE_TYPE_VALUES)('aceita type %s', (type) => {
    const parsed = parseCatalogFilters(new URLSearchParams(`type=${type}`));
    expect(parsed.type).toBe(type);
  });

  it('rejeita type fora do contrato', () => {
    expect(parseCatalogFilters(new URLSearchParams('type=qualquer-outra')).type).toBe('');
  });
});

describe('parseCatalogFilters — sort legado ending_soon', () => {
  it('normaliza ending_soon para popular (D0.4)', () => {
    const parsed = parseCatalogFilters(new URLSearchParams('sort=ending_soon'));
    expect(parsed.sort).toBe('popular');
  });

  it('build nunca serializa ending_soon (não faz parte do tipo)', () => {
    const params = buildCatalogParams(makeCatalogFilters({ sort: 'popular' }));
    expect(params.get('sort')).toBeNull();
  });
});

describe('parseCatalogFilters — estilos normalizados (R11)', () => {
  it('faz trim, dedupe e ordenação determinística', () => {
    const parsed = parseCatalogFilters(
      new URLSearchParams('styles=%20narrativista%20,dark%20fantasy,narrativista')
    );
    expect(parsed.styles).toEqual(['dark fantasy', 'narrativista']);
  });

  it('descarta entradas vazias', () => {
    const parsed = parseCatalogFilters(new URLSearchParams('styles=,a,,b,'));
    expect(parsed.styles).toEqual(['a', 'b']);
  });

  it('descarta estilos acima do limite canônico de 50 caracteres', () => {
    const params = new URLSearchParams();
    params.set('styles', `válido,${'x'.repeat(51)}`);

    expect(parseCatalogFilters(params).styles).toEqual(['válido']);
  });

  it('preserva o valor bruto quando decodeURIComponent recebe encoding malformado', () => {
    const params = new URLSearchParams({ styles: '%E0%A4%A' });

    expect(parseCatalogFilters(params).styles).toEqual(['%E0%A4%A']);
  });

  it('build normaliza antes de encodar (ordem de clique não muda a URL)', () => {
    const a = buildCatalogParams(makeCatalogFilters({ styles: ['b', 'a', 'b'] }));
    const b = buildCatalogParams(makeCatalogFilters({ styles: ['a', 'b'] }));
    expect(a.get('styles')).toBe(b.get('styles'));
  });
});

describe('parseCatalogFilters / buildCatalogParams — featured e facetas reprovadas', () => {
  it('featured não existe no estado nem é serializado pelo build', () => {
    const withFeatured = new URLSearchParams('featured=true&type=campanha');
    const parsed = parseCatalogFilters(withFeatured);
    expect(parsed).not.toHaveProperty('featured');
    expect(parsed.type).toBe('campanha');

    const built = buildCatalogParams(makeCatalogFilters({ type: 'campanha' }));
    expect(built.has('featured')).toBe(false);
    expect(built.toString()).not.toContain('featured');
  });

  it('audience, state e city são ignorados (fora do contrato do frontend)', () => {
    const parsed = parseCatalogFilters(
      new URLSearchParams('audience=livre&state=SP&city=Sao%20Paulo&type=campanha')
    );
    expect(parsed).not.toHaveProperty('audience');
    expect(parsed).not.toHaveProperty('state');
    expect(parsed).not.toHaveProperty('city');
    expect(parsed.type).toBe('campanha');
  });
});

describe('buildCatalogParams — page reset e defaults', () => {
  it('omite page=1 (default), mantém page>1', () => {
    expect(buildCatalogParams(makeCatalogFilters({ page: 1 })).has('page')).toBe(false);
    expect(buildCatalogParams(makeCatalogFilters({ page: 2 })).get('page')).toBe('2');
  });

  // R14: o reset para página 1 em mudança de filtro é feito pelos callers
  // (updateFilter em CatalogoPage). O contrato garante o lado que lhe cabe:
  // depois do reset, page=1 some da URL e o parse devolve 1.
  it('filtro alterado com page resetada produz URL sem page e parse devolve 1', () => {
    const reset = makeCatalogFilters({ type: 'campanha', page: 1 });
    const params = buildCatalogParams(reset);
    expect(params.has('page')).toBe(false);
    expect(parseCatalogFilters(params).page).toBe(1);
  });

  it('omite sort=popular (default)', () => {
    expect(buildCatalogParams(makeCatalogFilters({ sort: 'popular' })).has('sort')).toBe(false);
    expect(buildCatalogParams(makeCatalogFilters({ sort: 'slots' })).get('sort')).toBe('slots');
  });
});
