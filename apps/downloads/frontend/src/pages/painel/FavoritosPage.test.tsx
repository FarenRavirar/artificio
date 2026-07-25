import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FavoritosPage } from './FavoritosPage';
import * as useFavoritesModule from '../../hooks/useFavorites';
import type { Favorite } from '../../types/panel';

// Débito (27 páginas sem teste de componente) — cobertura de FavoritosPage
// (painel do usuário comum, spec 074): lista de favoritos, loading, vazio e
// remoção de favorito.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function makeFavorite(overrides: Partial<Favorite> = {}): Favorite {
  return {
    id: 'fav-1',
    slug: 'material-1',
    title: 'Material 1',
    material_type: 'pdf',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel/favoritos']}>
        <FavoritosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockUseFavorites(overrides: Partial<ReturnType<typeof useFavoritesModule.useFavorites>> = {}) {
  vi.spyOn(useFavoritesModule, 'useFavorites').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useFavoritesModule.useFavorites>);
}

function mockUseRemoveFavorite(overrides: Partial<ReturnType<typeof useFavoritesModule.useRemoveFavorite>> = {}) {
  const mutate = vi.fn();
  vi.spyOn(useFavoritesModule, 'useRemoveFavorite').mockReturnValue({
    mutate,
    ...overrides,
  } as unknown as ReturnType<typeof useFavoritesModule.useRemoveFavorite>);
  return mutate;
}

describe('FavoritosPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockUseFavorites({ isLoading: true });
    mockUseRemoveFavorite();

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem de lista vazia quando não há favoritos', () => {
    mockUseFavorites({ data: [] });
    mockUseRemoveFavorite();

    renderPage();

    expect(screen.getByText('Nenhum favorito ainda.')).toBeInTheDocument();
  });

  it('lista os favoritos do usuário', () => {
    mockUseFavorites({
      data: [
        makeFavorite({ id: 'fav-1', title: 'Aventura 1', slug: 'aventura-1' }),
        makeFavorite({ id: 'fav-2', title: 'Aventura 2', slug: 'aventura-2' }),
      ],
    });
    mockUseRemoveFavorite();

    renderPage();

    expect(screen.getByText('Aventura 1')).toBeInTheDocument();
    expect(screen.getByText('Aventura 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aventura 1' })).toHaveAttribute('href', '/materiais/aventura-1');
  });

  it('remove um favorito ao clicar em Remover', async () => {
    mockUseFavorites({
      data: [makeFavorite({ id: 'fav-1', title: 'Aventura 1', slug: 'aventura-1' })],
    });
    const mutate = mockUseRemoveFavorite();

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith('fav-1');
    });
  });
});
