import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoPublicadoresPage } from './GestaoPublicadoresPage';
import * as useAdminCreatorsModule from '../../hooks/useAdminCreators';

// Débito (27 páginas sem teste de componente): cobertura de
// GestaoPublicadoresPage — loading/vazio/erro/lista, busca por
// nome/slug e paginação (T2.7, spec 082).


function makeCreator(overrides: Partial<ReturnType<typeof baseCreator>> = {}) {
  return { ...baseCreator(), ...overrides };
}

function baseCreator() {
  return {
    id: 'creator-1',
    slug: 'editora-x',
    display_name: 'Editora X',
    role: 'publisher',
    created_at: '2026-07-01T00:00:00.000Z',
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/publicadores']}>
        <GestaoPublicadoresPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockAdminCreators(overrides: Partial<ReturnType<typeof useAdminCreatorsModule.useAdminCreators>> = {}) {
  const refetch = vi.fn();
  vi.spyOn(useAdminCreatorsModule, 'useAdminCreators').mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useAdminCreatorsModule.useAdminCreators>);
  return refetch;
}

describe('GestaoPublicadoresPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockAdminCreators({ isLoading: true });

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há publicadores', () => {
    mockAdminCreators({ data: { items: [], total: 0, page: 1, page_size: 20 } });

    renderPage();

    expect(screen.getByText('Nenhum publicador encontrado.')).toBeInTheDocument();
  });

  it('mostra erro e permite tentar novamente', () => {
    const refetch = mockAdminCreators({ isError: true, error: new Error('Falha ao buscar publicadores: HTTP 500') });

    renderPage();

    expect(screen.getByText('Falha ao buscar publicadores: HTTP 500')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('renderiza a lista de publicadores com nome, slug e role', () => {
    mockAdminCreators({ data: { items: [makeCreator()], total: 1, page: 1, page_size: 20 } });

    renderPage();

    expect(screen.getByText('Editora X')).toBeInTheDocument();
    expect(screen.getByText('editora-x · publisher')).toBeInTheDocument();
  });

  it('busca por nome ou identificador ao submeter o formulário', () => {
    mockAdminCreators({ data: { items: [makeCreator()], total: 1, page: 1, page_size: 20 } });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou identificador...'), {
      target: { value: 'editora' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(useAdminCreatorsModule.useAdminCreators).toHaveBeenLastCalledWith({ q: 'editora', page: 1 });
  });

  it('navega entre páginas quando há mais itens que o tamanho da página', () => {
    mockAdminCreators({ data: { items: [makeCreator()], total: 40, page: 1, page_size: 20 } });

    renderPage();

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(useAdminCreatorsModule.useAdminCreators).toHaveBeenLastCalledWith({ q: undefined, page: 2 });
  });
});
