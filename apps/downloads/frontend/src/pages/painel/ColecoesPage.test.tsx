import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ColecoesPage } from './ColecoesPage';
import * as useCollectionsModule from '../../hooks/useCollections';
import type { Collection } from '../../types/panel';

// Débito (27 páginas sem teste de componente) — cobertura de ColecoesPage
// (painel do usuário comum, spec 074): listagem de coleções e criação via form.


vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Spec 088 — fixture tipada contra `Collection` (schema real), nao contra um
// objeto ad-hoc: o helper omitia `user_id`/`created_at`/`updated_at` e ninguem
// percebia porque os testes estavam fora de qualquer tsconfig. Tipar o retorno
// faz o proximo campo novo do schema quebrar aqui, em vez de passar silencioso.
function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'col-1',
    user_id: 'user-1',
    slug: 'col-1',
    title: 'Coleção 1',
    is_public: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel/colecoes']}>
        <ColecoesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockCollections(overrides: Partial<ReturnType<typeof useCollectionsModule.useCollections>> = {}) {
  vi.spyOn(useCollectionsModule, 'useCollections').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCollectionsModule.useCollections>);
}

function mockCreateCollection(overrides: Partial<ReturnType<typeof useCollectionsModule.useCreateCollection>> = {}) {
  vi.spyOn(useCollectionsModule, 'useCreateCollection').mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(makeCollection()),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCollectionsModule.useCreateCollection>);
}

describe('ColecoesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockCollections({ isLoading: true, data: undefined });
    mockCreateCollection();

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem de lista vazia quando não há coleções', () => {
    mockCollections({ data: [] });
    mockCreateCollection();

    renderPage();

    expect(screen.getByText('Nenhuma coleção ainda.')).toBeInTheDocument();
  });

  it('lista as coleções retornadas com visibilidade', () => {
    mockCollections({
      data: [
        makeCollection({ id: 'col-1', title: 'Favoritos de aventuras', is_public: true }),
        makeCollection({ id: 'col-2', title: 'Privada minha', is_public: false }),
      ],
    });
    mockCreateCollection();

    renderPage();

    expect(screen.getByText('Favoritos de aventuras')).toBeInTheDocument();
    expect(screen.getByText('Privada minha')).toBeInTheDocument();
    expect(screen.getByText('Pública')).toBeInTheDocument();
    expect(screen.getByText('Privada')).toBeInTheDocument();
  });

  it('cria uma coleção ao submeter o formulário', async () => {
    mockCollections({ data: [] });
    const mutateAsync = vi.fn().mockResolvedValue(makeCollection());
    mockCreateCollection({ mutateAsync });

    renderPage();

    const input = screen.getByPlaceholderText('Nome da coleção');
    fireEvent.change(input, { target: { value: 'Minha Nova Coleção' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ slug: 'minha-nova-cole-o', title: 'Minha Nova Coleção' });
    });
    expect(toast.success).toHaveBeenCalledWith('Coleção criada.');
  });

  it('mostra toast de erro quando a criação falha', async () => {
    mockCollections({ data: [] });
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Falha ao criar coleção: HTTP 500'));
    mockCreateCollection({ mutateAsync });

    renderPage();

    const input = screen.getByPlaceholderText('Nome da coleção');
    fireEvent.change(input, { target: { value: 'Coleção Erro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Falha ao criar coleção: HTTP 500');
    });
  });

  it('não envia o formulário quando o título está vazio', () => {
    mockCollections({ data: [] });
    const mutateAsync = vi.fn();
    mockCreateCollection({ mutateAsync });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
