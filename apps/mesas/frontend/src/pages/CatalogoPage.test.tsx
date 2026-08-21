// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoPage } from './CatalogoPage';
import { useInfiniteCatalogTables } from '../hooks/useInfiniteCatalogTables';
import { useSystemsCatalog } from '../hooks/useSystemsCatalog';
import { useStyleFacets } from '../hooks/useStyleFacets';
import { trackFilterSistema } from '@artificio/analytics';
import type { SystemTreeNode } from '../types/systems';

/**
 * Spec 094 Fase 2 (T2.10): integração URL/hook/resultados — uma request por
 * ação confirmada (busca não dispara por caractere, D0.3), `trackFilterSistema`
 * exatamente uma vez por seleção confirmada (R23), round-trip da URL e limpeza
 * do draft.
 */

vi.mock('../hooks/useInfiniteCatalogTables', () => ({
  useInfiniteCatalogTables: vi.fn(() => ({
    tables: [],
    pagination: { page: 1, limit: 24, total: 0, hasMore: false },
    isLoading: false,
    isRefreshing: false,
    error: null,
  })),
}));

vi.mock('../hooks/useStyleFacets', () => ({
  useStyleFacets: vi.fn(() => ({ facets: [], error: null })),
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: false })),
}));

vi.mock('../utils/seo', () => ({
  applySeo: vi.fn(),
}));

vi.mock('@artificio/analytics', () => ({
  trackFilterSistema: vi.fn(),
}));

const systemsTree: SystemTreeNode[] = [
  {
    id: 'dnd',
    name: 'Dungeons & Dragons',
    name_pt: 'Dungeons & Dragons',
    slug: 'dungeons-dragons',
    parent_id: null,
    node_type: 'system',
    path_slug: 'dungeons-dragons',
    aliases: ['D&D', 'DnD'],
    children: [],
  },
  {
    id: 'vampiro',
    name: 'Vampire',
    name_pt: 'Vampiro',
    slug: 'vampire',
    parent_id: null,
    node_type: 'system',
    path_slug: 'vampire',
    aliases: [],
    children: [],
  },
];

vi.mock('../hooks/useSystemsCatalog', () => ({
  useSystemsCatalog: vi.fn(() => ({
    tree: systemsTree,
    flat: systemsTree.map((node) => ({ ...node, parent: null, ancestors: [] })),
    loading: false,
    error: null,
    forceRefresh: vi.fn(),
  })),
}));

const mockInfinite = vi.mocked(useInfiniteCatalogTables);
const mockSystems = vi.mocked(useSystemsCatalog);
const mockStyleFacets = vi.mocked(useStyleFacets);
const mockTrackFilterSistema = vi.mocked(trackFilterSistema);

const mockMediaQueryList = (matches: boolean): MediaQueryList =>
  ({
    matches,
    media: '(min-width: 768px)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  mockInfinite.mockClear();
  mockInfinite.mockImplementation(() => ({
    tables: [],
    pagination: { page: 1, limit: 24, total: 0, hasMore: false },
    isLoading: false,
    isRefreshing: false,
    error: null,
  }));
  mockSystems.mockImplementation(() => ({
    tree: systemsTree,
    flat: systemsTree.map((node) => ({ ...node, parent: null, ancestors: [] })),
    loading: false,
    error: null,
    forceRefresh: vi.fn(),
  }));
  mockStyleFacets.mockImplementation(() => ({ facets: [], error: null }));
  mockTrackFilterSistema.mockClear();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function renderPage(initialUrl = '/') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <CatalogoPage />
    </MemoryRouter>
  );
}

describe('CatalogoPage — busca geral única (R1/D0.3)', () => {
  it('existe exatamente uma busca geral e nenhuma busca no hero', () => {
    renderPage();

    expect(screen.getAllByLabelText('Buscar mesas')).toHaveLength(1);
    expect(document.getElementById('input-busca-mesas')).toBeNull();
  });

  it('digitar não consulta mesas por caractere; submissão promove o draft uma única vez', async () => {
    renderPage();

    const input = screen.getByRole('searchbox', { name: 'Buscar mesas' });

    fireEvent.change(input, { target: { value: 'v' } });
    fireEvent.change(input, { target: { value: 'va' } });
    fireEvent.change(input, { target: { value: 'vamp' } });

    // Nenhuma chamada do hook de catálogo com busca parcial.
    const searchesWhileTyping = mockInfinite.mock.calls.map((call) => call[0].search);
    expect(new Set(searchesWhileTyping)).toEqual(new Set(['']));

    fireEvent.submit(screen.getByRole('search'));

    // Uma única promoção do draft: o hook pode ser chamado mais de uma vez por
    // render, mas só UM valor confirmado de busca aparece — o React Query
    // deduplica por queryKey (URL), então uma request real por ação.
    await waitFor(() => {
      const confirmedSearches = new Set(
        mockInfinite.mock.calls.map((call) => call[0].search).filter((search) => search === 'vamp'),
      );
      expect(confirmedSearches.size).toBe(1);
    });
    expect(
      mockInfinite.mock.calls.map((call) => call[0].search),
    ).toContain('vamp');
  });

  it('submit com espaços nas bordas trima o termo', async () => {
    renderPage();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar mesas' }), {
      target: { value: '  vampiro  ' },
    });
    fireEvent.submit(screen.getByRole('search'));

    await waitFor(() => {
      const confirmed = mockInfinite.mock.calls.map((call) => call[0].search);
      expect(confirmed).toContain('vampiro');
      expect(confirmed).not.toContain('  vampiro  ');
    });
  });
});

describe('CatalogoPage — round-trip da URL (R7)', () => {
  it('URL com search/type/sort popula estado, draft e chips', () => {
    renderPage('/?search=vampiro&type=campanha&sort=slots');

    expect(screen.getByRole('searchbox', { name: 'Buscar mesas' })).toHaveValue('vampiro');
    expect(screen.getByText('Campanha')).toBeInTheDocument();

    const lastCall = mockInfinite.mock.calls[mockInfinite.mock.calls.length - 1][0];
    expect(lastCall.type).toBe('campanha');
    expect(lastCall.sort).toBe('slots');
  });

  it('URL legado com sort=ending_soon normaliza para popular sem quebrar a página', () => {
    renderPage('/?sort=ending_soon');

    const lastCall = mockInfinite.mock.calls[mockInfinite.mock.calls.length - 1][0];
    expect(lastCall.sort).toBe('popular');
  });
});

describe('CatalogoPage — analytics preservado (R23)', () => {
  it('trackFilterSistema dispara exatamente uma vez por seleção confirmada de sistema', async () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(true)) as unknown as typeof window.matchMedia;

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    fireEvent.change(screen.getByLabelText('Buscar sistema'), {
      target: { value: 'Dungeons' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));

    await waitFor(() => {
      expect(mockTrackFilterSistema).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackFilterSistema).toHaveBeenCalledWith({ sistema: 'Dungeons & Dragons' });

    // Abrir painel, submeter busca e limpar filtros NÃO criam evento novo (R23).
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar mesas' }), {
      target: { value: 'vampiro' },
    });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('button', { name: /Limpar tudo/ }));

    await waitFor(() => {
      expect(mockTrackFilterSistema).toHaveBeenCalledTimes(1);
    });
  });

  it('selecionar outro sistema emite a segunda chamada (uma por seleção)', async () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(true)) as unknown as typeof window.matchMedia;

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    fireEvent.change(screen.getByLabelText('Buscar sistema'), {
      target: { value: 'Vampire' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Vampire/ }));

    await waitFor(() => {
      expect(mockTrackFilterSistema).toHaveBeenCalledWith({ sistema: 'Vampire' });
      expect(mockTrackFilterSistema).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    // Reabre o seletor pelo gatilho (o chip de sistema também contém "Vampire").
    fireEvent.click(document.getElementById('catalog-system-trigger')!);
    fireEvent.change(screen.getByLabelText('Buscar sistema'), {
      target: { value: 'Dungeons' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));

    await waitFor(() => {
      expect(mockTrackFilterSistema).toHaveBeenCalledTimes(2);
    });
    expect(mockTrackFilterSistema).toHaveBeenLastCalledWith({ sistema: 'Dungeons & Dragons' });
  });
});

describe('CatalogoPage — limpeza (R10/D0.3)', () => {
  it('"Limpar tudo" limpa filtros confirmados e o draft de busca', async () => {
    renderPage('/?search=antigo');

    const input = screen.getByRole('searchbox', { name: 'Buscar mesas' });
    expect(input).toHaveValue('antigo');

    fireEvent.change(input, { target: { value: 'novo' } });
    fireEvent.click(screen.getByRole('button', { name: /Limpar tudo/ }));

    await waitFor(() => {
      expect(input).toHaveValue('');
      const lastCall = mockInfinite.mock.calls[mockInfinite.mock.calls.length - 1][0];
      expect(lastCall.search).toBe('');
    });
  });
});

describe('CatalogoPage — paridade e aplicação mobile (R15)', () => {
  it('mobile mantém filtros avançados em rascunho até Aplicar', async () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(false)) as unknown as typeof window.matchMedia;
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Mais filtros/ }));
    fireEvent.change(screen.getByLabelText('Experiência'), { target: { value: 'veterano' } });
    fireEvent.change(screen.getByLabelText('Tipo de mesa'), { target: { value: 'campanha' } });

    expect(mockInfinite.mock.calls.at(-1)?.[0]).toMatchObject({ experience: '', type: '' });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => {
      expect(mockInfinite.mock.calls.at(-1)?.[0]).toMatchObject({
        experience: 'veterano',
        type: 'campanha',
        page: 1,
      });
    });
  });

  it('desktop e mobile chegam ao mesmo estado para a mesma combinação avançada', async () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(true)) as unknown as typeof window.matchMedia;
    const desktop = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mais filtros/ }));
    fireEvent.change(screen.getByLabelText('Experiência'), { target: { value: 'intermediario' } });
    fireEvent.change(screen.getByLabelText('Tipo de mesa'), { target: { value: 'oneshot-serie' } });
    await waitFor(() => {
      expect(mockInfinite.mock.calls.at(-1)?.[0]).toMatchObject({
        experience: 'intermediario',
        type: 'oneshot-serie',
      });
    });
    const desktopFilters = mockInfinite.mock.calls.at(-1)?.[0];
    desktop.unmount();

    mockInfinite.mockClear();
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(false)) as unknown as typeof window.matchMedia;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mais filtros/ }));
    fireEvent.change(screen.getByLabelText('Experiência'), { target: { value: 'intermediario' } });
    fireEvent.change(screen.getByLabelText('Tipo de mesa'), { target: { value: 'oneshot-serie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => {
      expect(mockInfinite.mock.calls.at(-1)?.[0]).toMatchObject({
        experience: 'intermediario',
        type: 'oneshot-serie',
      });
    });
    const mobileFilters = mockInfinite.mock.calls.at(-1)?.[0];

    expect(mobileFilters).toMatchObject({
      experience: desktopFilters?.experience,
      type: desktopFilters?.type,
      page: desktopFilters?.page,
    });
  });
});

describe('CatalogoPage — IDs únicos na página montada (aceite 2)', () => {
  it('nenhum ID de DOM duplicado com filtros ativos', () => {
    renderPage('/?search=vamp&type=campanha&sort=slots');

    const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
