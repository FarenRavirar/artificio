import { afterEach, describe, expect, it } from 'vitest';
import { getSystemCatalogProvider, resolveSystemCatalogSource } from './systemCatalogProvider';

describe('resolveSystemCatalogSource', () => {
  afterEach(() => {
    delete process.env.APP_ENV;
  });

  it('usa Central somente em Mesas Prod', () => {
    expect(resolveSystemCatalogSource('production', 'production')).toBe('central');
    expect(resolveSystemCatalogSource('prod', 'production')).toBe('central');
  });

  it('usa projeção local em Mesas Beta', () => {
    expect(resolveSystemCatalogSource('beta', 'development')).toBe('local');
  });

  it('permite ambiente local e teste sem APP_ENV', () => {
    expect(resolveSystemCatalogSource(undefined, 'development')).toBe('local');
    expect(resolveSystemCatalogSource(undefined, 'test')).toBe('local');
  });

  it('falha fechado quando production não declara APP_ENV', () => {
    expect(() => resolveSystemCatalogSource(undefined, 'production'))
      .toThrow('system_catalog_environment_invalid:missing');
  });

  it('falha fechado para valor desconhecido', () => {
    expect(() => resolveSystemCatalogSource('staging', 'production'))
      .toThrow('system_catalog_environment_invalid:staging');
  });

  it('nunca entrega adapter local para Mesas Prod', () => {
    process.env.APP_ENV = 'production';
    expect(getSystemCatalogProvider().source).toBe('central');
  });

  it('nunca entrega adapter Central para Mesas Beta', () => {
    process.env.APP_ENV = 'beta';
    expect(getSystemCatalogProvider().source).toBe('local');
  });
});
