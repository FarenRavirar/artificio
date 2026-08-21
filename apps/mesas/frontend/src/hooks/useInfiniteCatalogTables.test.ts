// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInfiniteCatalogTables } from './useInfiniteCatalogTables';
import { useCatalogTables } from './useCatalogTables';
import type { CatalogFilters } from '../services/catalogService';
import type { TableCard } from '../types/tables';

/**
 * Spec 094 Fase 2 (T2.9/T2.10): reset do acumulado quando qualquer filter key
 * muda (incluindo as novas — `type`, `styles`) e descarte do acumulado
 * anterior; page=1 retorna só a página nova; dedupe preservado (R14, aceite 13).
 */

vi.mock('./useCatalogTables', () => ({
  useCatalogTables: vi.fn(),
}));

const mockUseCatalogTables = vi.mocked(useCatalogTables);

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

function table(id: string): TableCard {
  return { id } as TableCard;
}

function mockResponse(tables: TableCard[], page: number) {
  mockUseCatalogTables.mockReturnValue({
    tables,
    pagination: { page, total: 0, hasMore: true },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCatalogTables>);
}

beforeEach(() => {
  mockUseCatalogTables.mockReset();
});

describe('useInfiniteCatalogTables — acumulação por página (R14)', () => {
  it('acumula páginas da mesma filter key com dedupe', () => {
    mockResponse([table('a')], 1);

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteCatalogTables(filters, ''),
      { initialProps: { filters: makeFilters() } }
    );

    expect(result.current.tables).toEqual([table('a')]);

    // Página 2 com sobreposição de IDs: dedupe preserva 'a' e adiciona 'b'.
    mockResponse([table('a'), table('b')], 2);
    rerender({ filters: makeFilters({ page: 2 }) });

    expect(result.current.tables).toEqual([table('a'), table('b')]);
  });

  it('page=1 com a mesma filter key substitui o acumulado (não concatena)', () => {
    mockResponse([table('a'), table('b')], 1);

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteCatalogTables(filters, ''),
      { initialProps: { filters: makeFilters({ page: 2 }) } }
    );

    expect(result.current.tables).toEqual([table('a'), table('b')]);

    mockResponse([table('c')], 1);
    rerender({ filters: makeFilters({ page: 1 }) });

    expect(result.current.tables).toEqual([table('c')]);
  });
});

describe('useInfiniteCatalogTables — reset por filter key (aceite 13)', () => {
  it('mudança de type descarta o acumulado anterior e parte da página nova', () => {
    mockResponse([table('a'), table('b')], 1);

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteCatalogTables(filters, ''),
      { initialProps: { filters: makeFilters({ page: 2 }) } }
    );

    expect(result.current.tables).toEqual([table('a'), table('b')]);

    mockResponse([table('c')], 1);
    rerender({ filters: makeFilters({ type: 'campanha' }) });

    // Nenhum resultado da consulta anterior permanece.
    expect(result.current.tables).toEqual([table('c')]);
  });

  it('mudança de styles descarta o acumulado anterior', () => {
    mockResponse([table('a'), table('b')], 1);

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteCatalogTables(filters, ''),
      { initialProps: { filters: makeFilters({ page: 2, styles: ['horror'] }) } }
    );

    expect(result.current.tables).toEqual([table('a'), table('b')]);

    mockResponse([table('d')], 1);
    rerender({ filters: makeFilters({ styles: ['horror', 'investigacao'] }) });

    expect(result.current.tables).toEqual([table('d')]);
  });

  it('mudança de search descarta o acumulado anterior', () => {
    mockResponse([table('a'), table('b')], 1);

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteCatalogTables(filters, ''),
      { initialProps: { filters: makeFilters({ page: 2, search: 'vamp' }) } }
    );

    expect(result.current.tables).toEqual([table('a'), table('b')]);

    mockResponse([table('e')], 1);
    rerender({ filters: makeFilters({ search: 'dnd' }) });

    expect(result.current.tables).toEqual([table('e')]);
  });

  it('mudança de seal descarta o acumulado anterior', () => {
    mockResponse([table('a'), table('b')], 1);

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteCatalogTables(filters, ''),
      { initialProps: { filters: makeFilters({ page: 2, seal: 'ddal' }) } }
    );

    expect(result.current.tables).toEqual([table('a'), table('b')]);

    mockResponse([table('f')], 1);
    rerender({ filters: makeFilters({ seal: 'covil-do-lich' }) });

    expect(result.current.tables).toEqual([table('f')]);
  });

  it('mudança de sort também reseta (faz parte da filter key da query)', () => {
    mockResponse([table('a'), table('b')], 1);

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteCatalogTables(filters, ''),
      { initialProps: { filters: makeFilters({ page: 2, sort: 'popular' }) } }
    );

    expect(result.current.tables).toEqual([table('a'), table('b')]);

    mockResponse([table('g')], 1);
    rerender({ filters: makeFilters({ sort: 'slots' }) });

    expect(result.current.tables).toEqual([table('g')]);
  });
});
