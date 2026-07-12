import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogoPage } from './CatalogoPage';
import * as useMaterialsCatalogModule from '../hooks/useMaterialsCatalog';
import type { Material, MaterialListResponse } from '../types/material';

// T6.2 (spec 073) — busca/filtro/paginacao vivem como contrato unico de URL.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    slug: 'material-1',
    title: 'Material 1',
    summary: null,
    description: null,
    material_type: 'adventure',
    access_kind: 'external_link',
    external_url: 'https://example.test/a.pdf',
    creator_id: 'user-1',
    creator_slug: 'criador-1',
    editorial_state: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage(initialEntries: string[] = ['/catalogo']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <CatalogoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CatalogoPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra os materiais retornados pela busca', async () => {
    const response: MaterialListResponse = {
      items: [makeMaterial()],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage();

    expect(await screen.findByText('Material 1')).toBeInTheDocument();
  });

  it('mostra mensagem quando nenhum material e encontrado', async () => {
    const response: MaterialListResponse = { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage();

    expect(await screen.findByText(/nenhum material encontrado/i)).toBeInTheDocument();
  });

  it('atualiza a query string ao digitar na busca', async () => {
    const response: MaterialListResponse = { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage();

    const input = screen.getByPlaceholderText(/buscar por nome ou resumo/i);
    fireEvent.change(input, { target: { value: 'aventura' } });

    await waitFor(() => {
      expect(useMaterialsCatalogModule.useMaterialsCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'aventura' }),
      );
    }, { timeout: 1000 });
  });
});
