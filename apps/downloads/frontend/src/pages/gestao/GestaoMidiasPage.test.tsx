import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { GestaoMidiasPage } from './GestaoMidiasPage';
import * as useAdminMediaModule from '../../hooks/useAdminMedia';

// T2.7 (spec 082) — cobre loading, erro com retry, lista vazia e o fluxo de
// editar URL de capa + salvar (sucesso e falha), coerente com o MVP
// somente-link-externo descrito no comentário da página.


vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/materiais/midias']}>
        <GestaoMidiasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockAdminMedia(overrides: Partial<ReturnType<typeof useAdminMediaModule.useAdminMedia>> = {}) {
  return vi.spyOn(useAdminMediaModule, 'useAdminMedia').mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAdminMediaModule.useAdminMedia>);
}

function mockUpdateCover(overrides: Partial<ReturnType<typeof useAdminMediaModule.useUpdateCoverImage>> = {}) {
  return vi.spyOn(useAdminMediaModule, 'useUpdateCoverImage').mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAdminMediaModule.useUpdateCoverImage>);
}

describe('GestaoMidiasPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    (toast.success as ReturnType<typeof vi.fn>).mockClear();
    (toast.error as ReturnType<typeof vi.fn>).mockClear();
  });

  it('mostra estado de carregamento', () => {
    mockAdminMedia({ isLoading: true });
    mockUpdateCover();

    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('mostra erro com botão de tentar novamente e chama refetch ao clicar', () => {
    const refetch = vi.fn();
    mockAdminMedia({
      isError: true,
      error: new Error('Falha ao buscar mídias: HTTP 500'),
      refetch,
    });
    mockUpdateCover();

    renderPage();

    expect(screen.getByText('Falha ao buscar mídias: HTTP 500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('mostra mensagem de lista vazia quando não há materiais', () => {
    mockAdminMedia({ data: { items: [] } });
    mockUpdateCover();

    renderPage();

    expect(screen.getByText(/nenhum material cadastrado ainda/i)).toBeInTheDocument();
  });

  it('lista materiais com título, estado editorial e URL de capa atual', () => {
    mockAdminMedia({
      data: {
        items: [
          {
            material_id: 'mat-1',
            material_slug: 'aventura-teste',
            material_title: 'Aventura Teste',
            editorial_state: 'published',
            cover_image_url: 'https://example.test/capa.jpg',
          },
        ],
      },
    });
    mockUpdateCover();

    renderPage();

    expect(screen.getByText('Aventura Teste')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.test/capa.jpg')).toBeInTheDocument();
  });

  it('salva nova URL de capa e mostra toast de sucesso', async () => {
    mockAdminMedia({
      data: {
        items: [
          {
            material_id: 'mat-1',
            material_slug: 'aventura-teste',
            material_title: 'Aventura Teste',
            editorial_state: 'draft',
            cover_image_url: null,
          },
        ],
      },
    });
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockUpdateCover({ mutateAsync });

    renderPage();

    expect(screen.getByText('Rascunho')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('https://…');
    fireEvent.change(input, { target: { value: 'https://example.test/nova-capa.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        materialId: 'mat-1',
        coverImageUrl: 'https://example.test/nova-capa.jpg',
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Capa atualizada.'));
  });

  it('mostra toast de erro quando salvar a capa falha', async () => {
    mockAdminMedia({
      data: {
        items: [
          {
            material_id: 'mat-1',
            material_slug: 'aventura-teste',
            material_title: 'Aventura Teste',
            editorial_state: 'draft',
            cover_image_url: null,
          },
        ],
      },
    });
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Falha ao salvar capa: HTTP 500'));
    mockUpdateCover({ mutateAsync });

    renderPage();

    const input = screen.getByPlaceholderText('https://…');
    fireEvent.change(input, { target: { value: 'https://example.test/nova-capa.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Falha ao salvar capa: HTTP 500'),
    );
  });
});
