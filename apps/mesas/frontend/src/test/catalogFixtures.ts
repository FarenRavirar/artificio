import type { CatalogFilters } from '../services/catalogService';

export function makeCatalogFilters(overrides: Partial<CatalogFilters> = {}): CatalogFilters {
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
