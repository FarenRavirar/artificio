import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoMateriaisPage } from './GestaoMateriaisPage';
import * as useMaterialsCatalogModule from '../../hooks/useMaterialsCatalog';

// T4.x (spec 075) — cobertura de teste do débito (páginas sem teste de
// componente): render de loading/lista vazia/lista com itens, rótulo de
// editorial_state e link de auditoria por item.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function makeMaterial(overrides: Partial<ReturnType<typeof baseMaterial>> = {}) {
  return { ...baseMaterial(), ...overrides };
}

function baseMaterial() {
  return {
    id: 'material-1',
    title: 'Manual do Aventureiro',
    editorial_state: 'published',
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/materiais']}>
        <GestaoMateriaisPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockMaterialsCatalog(overrides: Partial<ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>> = {}) {
  vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);
}

describe('GestaoMateriaisPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockMaterialsCatalog({ data: undefined, isLoading: true });

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renderiza lista vazia sem itens quando não há materiais', () => {
    mockMaterialsCatalog({ data: { items: [], total: 0 }, isLoading: false });

    renderPage();

    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    const list = document.querySelector('ul.mt-6');
    expect(list?.children.length ?? 0).toBe(0);
  });

  it('renderiza a lista de materiais com título, estado editorial e link de auditoria', () => {
    mockMaterialsCatalog({
      data: { items: [makeMaterial()], total: 1 },
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('Manual do Aventureiro')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();

    const link = screen
      .getAllByRole('link', { name: 'Auditoria' })
      .find((el) => el.getAttribute('href') === '/gestao/auditoria/material-1');
    expect(link).toHaveAttribute('href', '/gestao/auditoria/material-1');
  });

  it('usa o valor bruto de editorial_state quando não há rótulo mapeado', () => {
    mockMaterialsCatalog({
      data: { items: [makeMaterial({ id: 'material-2', editorial_state: 'unknown_state' })], total: 1 },
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('unknown_state')).toBeInTheDocument();
  });
});
