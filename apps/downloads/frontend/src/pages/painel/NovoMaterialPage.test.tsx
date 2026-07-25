import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { NovoMaterialPage } from './NovoMaterialPage';
import * as useCreateMaterialModule from '../../hooks/useCreateMaterial';
import * as useMaterialTypesModule from '../../hooks/useMaterialTypes';

// Débito (27 páginas sem teste de componente) — cobertura de NovoMaterialPage
// (T2.1 spec 082): criação de rascunho de material (slug/title/material_type),
// navegação para edição em caso de sucesso e toast de erro em caso de falha.


vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel/materiais/novo']}>
        <NovoMaterialPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ADVENTURE_ID = 'b071ab5e-2d16-4c58-8f0e-086000000001';

function mockCreateMaterial(overrides: Partial<ReturnType<typeof useCreateMaterialModule.useCreateMaterial>> = {}) {
  const mutateAsync = vi.fn();
  vi.spyOn(useCreateMaterialModule, 'useCreateMaterial').mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCreateMaterialModule.useCreateMaterial>);
  return mutateAsync;
}

describe('NovoMaterialPage', () => {
  beforeEach(() => {
    vi.spyOn(useMaterialTypesModule, 'useMaterialTypes').mockReturnValue({
      data: [{ id: ADVENTURE_ID, slug: 'aventura', name: 'Aventura', aliases: ['adventure'], status: 'active' }],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useMaterialTypesModule.useMaterialTypes>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    navigateMock.mockReset();
  });

  it('renderiza o formulário com os três campos e o botão de criar', () => {
    mockCreateMaterial();

    renderPage();

    expect(screen.getByText('Novo material')).toBeInTheDocument();
    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByText('Slug')).toBeInTheDocument();
    expect(screen.getByText('Tipo de material')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar rascunho' })).toBeInTheDocument();
  });

  it('exige preenchimento dos campos obrigatórios antes de submeter', async () => {
    const mutateAsync = mockCreateMaterial();

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('cria o material e navega para a tela de edição em caso de sucesso', async () => {
    const mutateAsync = mockCreateMaterial();
    mutateAsync.mockResolvedValue({ id: 'material-123' });

    renderPage();

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Meu Material' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'meu-material' } });
    fireEvent.change(screen.getByLabelText('Tipo de material'), { target: { value: ADVENTURE_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        slug: 'meu-material',
        title: 'Meu Material',
        material_type_id: ADVENTURE_ID,
      });
    });

    expect(toast.success).toHaveBeenCalledWith('Material criado como rascunho.');
    expect(navigateMock).toHaveBeenCalledWith('/painel/materiais/material-123/editar');
  });

  it('mostra toast de erro quando a criação falha', async () => {
    const mutateAsync = mockCreateMaterial();
    mutateAsync.mockRejectedValue(new Error('slug já existe'));

    renderPage();

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Meu Material' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'meu-material' } });
    fireEvent.change(screen.getByLabelText('Tipo de material'), { target: { value: ADVENTURE_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('slug já existe');
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('desabilita o botão de submit enquanto a criação está pendente', () => {
    mockCreateMaterial({ isPending: true });

    renderPage();

    expect(screen.getByRole('button', { name: 'Criando...' })).toBeDisabled();
  });

  it('bloqueia criação e avisa quando vocabulário Central falha', () => {
    mockCreateMaterial();
    vi.spyOn(useMaterialTypesModule, 'useMaterialTypes').mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useMaterialTypesModule.useMaterialTypes>);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Tipos indisponíveis');
    expect(screen.getByRole('button', { name: 'Criar rascunho' })).toBeDisabled();
  });
});
