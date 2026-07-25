import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { EditarMaterialPage } from './EditarMaterialPage';
import * as useMyMaterialsModule from '../../hooks/useMyMaterials';
import * as useUpdateMaterialModule from '../../hooks/useUpdateMaterial';
import * as useSubmitMaterialModule from '../../hooks/useSubmitMaterial';
import * as useMaterialHistoryModule from '../../hooks/useMaterialHistory';
import * as useMaterialMetadataModule from '../../hooks/useMaterialMetadata';
import * as useUpdateMaterialMetadataModule from '../../hooks/useUpdateMaterialMetadata';

// Débito (27 páginas sem teste de componente) — cobertura de EditarMaterialPage
// (T2.1/T2.2/T2.3 spec 074): carregamento dos campos a partir do material
// encontrado via useMyMaterials + materialId da rota, submissão do PATCH de
// edição (sucesso e erro) e histórico de edição por campo.


vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function makeMaterial(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'material-1',
    slug: 'material-1',
    title: 'Material Original',
    summary: 'Resumo original',
    description: 'Descrição original',
    external_url: 'https://exemplo.com/original',
    editorial_state: 'draft',
    ...overrides,
  };
}

function renderPage(materialId = 'material-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/painel/materiais/${materialId}/editar`]}>
        <Routes>
          <Route path="/painel/materiais/:materialId/editar" element={<EditarMaterialPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockMyMaterials(overrides: Partial<ReturnType<typeof useMyMaterialsModule.useMyMaterials>> = {}) {
  vi.spyOn(useMyMaterialsModule, 'useMyMaterials').mockReturnValue({
    data: [makeMaterial()],
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useMyMaterialsModule.useMyMaterials>);
}

function mockUpdateMaterial(overrides: Partial<ReturnType<typeof useUpdateMaterialModule.useUpdateMaterial>> = {}) {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(useUpdateMaterialModule, 'useUpdateMaterial').mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useUpdateMaterialModule.useUpdateMaterial>);
  return mutateAsync;
}

function mockSubmitMaterial(overrides: Partial<ReturnType<typeof useSubmitMaterialModule.useSubmitMaterial>> = {}) {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(useSubmitMaterialModule, 'useSubmitMaterial').mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useSubmitMaterialModule.useSubmitMaterial>);
  return mutateAsync;
}

function mockMaterialHistory(overrides: Partial<ReturnType<typeof useMaterialHistoryModule.useMaterialHistory>> = {}) {
  vi.spyOn(useMaterialHistoryModule, 'useMaterialHistory').mockReturnValue({
    data: [],
    ...overrides,
  } as unknown as ReturnType<typeof useMaterialHistoryModule.useMaterialHistory>);
}

function mockMaterialMetadata(overrides: Partial<ReturnType<typeof useMaterialMetadataModule.useMaterialMetadata>> = {}) {
  vi.spyOn(useMaterialMetadataModule, 'useMaterialMetadata').mockReturnValue({
    data: undefined,
    ...overrides,
  } as unknown as ReturnType<typeof useMaterialMetadataModule.useMaterialMetadata>);
}

function mockUpdateMaterialMetadata(
  overrides: Partial<ReturnType<typeof useUpdateMaterialMetadataModule.useUpdateMaterialMetadata>> = {},
) {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(useUpdateMaterialMetadataModule, 'useUpdateMaterialMetadata').mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useUpdateMaterialMetadataModule.useUpdateMaterialMetadata>);
  return mutateAsync;
}

function mockDefaults() {
  mockMyMaterials();
  const updateMutateAsync = mockUpdateMaterial();
  const submitMutateAsync = mockSubmitMaterial();
  mockMaterialHistory();
  mockMaterialMetadata();
  const updateMetadataMutateAsync = mockUpdateMaterialMetadata();
  return { updateMutateAsync, submitMutateAsync, updateMetadataMutateAsync };
}

describe('EditarMaterialPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    (toast.success as ReturnType<typeof vi.fn>).mockClear();
    (toast.error as ReturnType<typeof vi.fn>).mockClear();
  });

  it('mostra "Carregando..." enquanto useMyMaterials está pendente', () => {
    mockMyMaterials({ data: undefined, isLoading: true });
    mockUpdateMaterial();
    mockSubmitMaterial();
    mockMaterialHistory();
    mockMaterialMetadata();
    mockUpdateMaterialMetadata();

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem de não encontrado quando o materialId não pertence à conta', () => {
    mockMyMaterials({ data: [] });
    mockUpdateMaterial();
    mockSubmitMaterial();
    mockMaterialHistory();
    mockMaterialMetadata();
    mockUpdateMaterialMetadata();

    renderPage('material-inexistente');

    expect(screen.getByText('Material não encontrado ou não pertence à sua conta.')).toBeInTheDocument();
  });

  it('preenche os campos do formulário com os dados do material carregado', () => {
    mockDefaults();

    renderPage();

    expect(screen.getByLabelText('Título')).toHaveValue('Material Original');
    expect(screen.getByLabelText('Resumo')).toHaveValue('Resumo original');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Descrição original');
    expect(screen.getByLabelText('Link de destino')).toHaveValue('https://exemplo.com/original');
  });

  it('preenche a editora quando os metadados carregam', () => {
    mockMyMaterials();
    mockUpdateMaterial();
    mockSubmitMaterial();
    mockMaterialHistory();
    mockMaterialMetadata({
      data: {
        material_id: 'material-1',
        publisher_name: 'Editora Exemplo',
        credits: null,
        license_kind: null,
        license_url: null,
        language: null,
      },
    });
    mockUpdateMaterialMetadata();

    renderPage();

    expect(screen.getByLabelText('Editora/selo')).toHaveValue('Editora Exemplo');
  });

  it('mostra o botão "Enviar para revisão" quando o material está em draft', () => {
    mockDefaults();

    renderPage();

    expect(screen.getByRole('button', { name: 'Enviar para revisão' })).toBeInTheDocument();
  });

  it('não mostra o botão "Enviar para revisão" quando o material já está publicado', () => {
    mockMyMaterials({ data: [makeMaterial({ editorial_state: 'published' })] });
    mockUpdateMaterial();
    mockSubmitMaterial();
    mockMaterialHistory();
    mockMaterialMetadata();
    mockUpdateMaterialMetadata();

    renderPage();

    expect(screen.queryByRole('button', { name: 'Enviar para revisão' })).not.toBeInTheDocument();
  });

  it('salva as alterações do formulário e mostra toast de sucesso', async () => {
    const { updateMutateAsync, updateMetadataMutateAsync } = mockDefaults();

    renderPage();

    // Esse caso valida o payload/submissão, não a digitação por tecla. Usar
    // change evita timeout sob a concorrência do Turbo sem ampliar timeout.
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título Editado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      title: 'Título Editado',
      summary: 'Resumo original',
      description: 'Descrição original',
      external_url: 'https://exemplo.com/original',
    });

    // Achado real (review PR #201, Codex, follow-up): handleSubmit encadeia
    // updateMutateAsync -> updateMetadataMutateAsync -> toast.success; um
    // waitFor que só espera o primeiro não garante que os efeitos
    // posteriores já rodaram (flaky). waitFor aqui cobre o fim da cadeia.
    await waitFor(() => {
      expect(updateMetadataMutateAsync).toHaveBeenCalledWith({ publisher_name: null });
      expect(toast.success).toHaveBeenCalledWith('Material atualizado.');
    });
  });

  it('mostra toast de erro quando a atualização do material falha', async () => {
    mockMyMaterials();
    const updateMutateAsync = mockUpdateMaterial();
    updateMutateAsync.mockRejectedValue(new Error('falha ao salvar título'));
    mockSubmitMaterial();
    mockMaterialHistory();
    mockMaterialMetadata();
    mockUpdateMaterialMetadata();
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('falha ao salvar título');
    });
  });

  it('envia o material para revisão e mostra toast de sucesso', async () => {
    const { submitMutateAsync } = mockDefaults();
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Enviar para revisão' }));

    await waitFor(() => {
      expect(submitMutateAsync).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith('Material enviado para revisão.');
  });

  it('mostra toast de erro quando o envio para revisão falha', async () => {
    mockMyMaterials();
    mockUpdateMaterial();
    const submitMutateAsync = mockSubmitMaterial();
    submitMutateAsync.mockRejectedValue(new Error('transição inválida'));
    mockMaterialHistory();
    mockMaterialMetadata();
    mockUpdateMaterialMetadata();
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Enviar para revisão' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('transição inválida');
    });
  });

  it('mostra mensagem quando não há histórico de edição registrado', () => {
    mockDefaults();

    renderPage();

    expect(screen.getByText('Nenhuma edição registrada ainda.')).toBeInTheDocument();
  });

  it('renderiza as entradas do histórico de edição por campo', () => {
    mockMyMaterials();
    mockUpdateMaterial();
    mockSubmitMaterial();
    mockMaterialHistory({
      data: [
        {
          id: 'history-1',
          field_name: 'title',
          old_value: 'Título Antigo',
          new_value: 'Material Original',
          changed_at: '2026-07-01T12:00:00.000Z',
        },
      ],
    });
    mockMaterialMetadata();
    mockUpdateMaterialMetadata();

    renderPage();

    expect(screen.getAllByText('Título').length).toBeGreaterThan(0);
    expect(screen.getByText(/De: Título Antigo → Para: Material Original/)).toBeInTheDocument();
  });
});
