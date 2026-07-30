import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { EditarMaterialPage } from './EditarMaterialPage';
import * as useMyMaterialsModule from '../../hooks/useMyMaterials';
import * as useUpdateMaterialModule from '../../hooks/useUpdateMaterial';
import * as useSubmitMaterialModule from '../../hooks/useSubmitMaterial';
import * as useMaterialHistoryModule from '../../hooks/useMaterialHistory';
import type { Material } from '../../types/material';
import { makeMaterial as baseMaterial } from '../../test/fixtures';
import * as useMaterialMetadataModule from '../../hooks/useMaterialMetadata';
import * as useUpdateMaterialMetadataModule from '../../hooks/useUpdateMaterialMetadata';
import * as useCatalogSystemsModule from '../../hooks/useCatalogSystems';
import * as useUploadMaterialCoverModule from '../../hooks/useUploadMaterialCover';

const SYSTEM_A = '11111111-1111-4111-8111-111111111111';
const EDITION_A = '22222222-2222-4222-8222-222222222222';
const SYSTEM_B = '33333333-3333-4333-8333-333333333333';

// Débito (27 páginas sem teste de componente) — cobertura de EditarMaterialPage
// (T2.1/T2.2/T2.3 spec 074): carregamento dos campos a partir do material
// encontrado via useMyMaterials + materialId da rota, submissão do PATCH de
// edição (sucesso e erro) e histórico de edição por campo.


vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Spec 088 — usa a fixture compartilhada (`src/test/fixtures`), so trocando o
// que as assercoes deste arquivo esperam (rascunho com resumo e descricao
// preenchidos, pra o formulario ter o que editar). Antes o
// `Partial<Record<string, unknown>>` aceitava QUALQUER chave com QUALQUER
// valor: era tipagem nominal, sem verificacao nenhuma.
function makeMaterial(overrides: Partial<Material> = {}): Material {
  return baseMaterial({
    id: 'material-1',
    title: 'Material Original',
    summary: 'Resumo original',
    description: 'Descrição original',
    external_url: 'https://exemplo.com/original',
    editorial_state: 'draft',
    ...overrides,
  });
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

function mockCatalogSystems() {
  vi.spyOn(useCatalogSystemsModule, 'useCatalogSystems').mockReturnValue({
    data: [
      { id: SYSTEM_A, name: 'Sistema A', slug: 'a', node_type: 'system', parent_id: null },
      { id: EDITION_A, name: 'Edição A', slug: 'ed-a', node_type: 'edition', parent_id: SYSTEM_A },
      { id: SYSTEM_B, name: 'Sistema B', slug: 'b', node_type: 'system', parent_id: null },
    ],
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCatalogSystemsModule.useCatalogSystems>);
}

function mockUploadMaterialCover(
  overrides: Partial<ReturnType<typeof useUploadMaterialCoverModule.useUploadMaterialCover>> = {},
) {
  const mutateAsync = vi.fn().mockResolvedValue({
    cover_image_url: 'https://cdn.example.test/capa.png',
    width: 1200,
    height: 630,
    mime_type: 'image/png',
  });
  vi.spyOn(useUploadMaterialCoverModule, 'useUploadMaterialCover').mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useUploadMaterialCoverModule.useUploadMaterialCover>);
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
  beforeEach(() => {
    mockCatalogSystems();
    mockUploadMaterialCover();
    vi.spyOn(useUploadMaterialCoverModule, 'useCoverCapabilities').mockReturnValue({
      data: { cloudinary_enabled: true },
    } as unknown as ReturnType<typeof useUploadMaterialCoverModule.useCoverCapabilities>);
    vi.spyOn(useUploadMaterialCoverModule, 'useImportMaterialCoverUrl').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUploadMaterialCoverModule.useImportMaterialCoverUrl>);
  });

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
    expect(screen.getByLabelText('Descrição do material')).toHaveValue('Descrição original');
    expect(screen.getByLabelText('Link de destino')).toHaveValue('https://exemplo.com/original');
  });

  it('só marca checklist concluído quando o dado já está persistido', () => {
    mockMyMaterials({ data: [makeMaterial({
      description: null,
      description_markdown: null,
      authors: [],
      system_id: null,
      cover_image_url: null,
      external_url: null,
    })] });
    mockUpdateMaterial();
    mockSubmitMaterial();
    mockMaterialHistory();
    mockMaterialMetadata();
    mockUpdateMaterialMetadata();
    renderPage();

    const checklist = screen.getByRole('region', { name: 'Etapas para publicar' });
    const labels = ['Descrição e créditos', 'Sistema', 'Capa', 'Destino', 'Prévia do conteúdo'];
    const stateFor = (label: string) => within(within(checklist).getByText(label).closest('li')!).getByText(/pendente|concluída/);
    for (const label of labels) expect(stateFor(label)).toHaveTextContent('pendente');

    fireEvent.change(screen.getByLabelText('Descrição do material'), { target: { value: 'Descrição digitada' } });
    fireEvent.change(screen.getByLabelText('Autores'), { target: { value: 'Autora' } });
    fireEvent.change(screen.getByLabelText('Sistema'), { target: { value: SYSTEM_A } });
    fireEvent.change(screen.getByLabelText('URL da capa'), { target: { value: 'https://example.test/capa.png' } });
    fireEvent.change(screen.getByLabelText('Link de destino'), { target: { value: 'https://example.test/material' } });

    for (const label of labels) expect(stateFor(label)).toHaveTextContent('pendente');
  });

  it('preenche a editora quando os metadados carregam', () => {
    mockMyMaterials({ data: [makeMaterial({ publisher_name: 'Editora Exemplo' })] });
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
      external_url: 'https://exemplo.com/original',
    });

    // Achado real (review PR #201, Codex, follow-up): handleSubmit encadeia
    // updateMutateAsync -> updateMetadataMutateAsync -> toast.success; um
    // waitFor que só espera o primeiro não garante que os efeitos
    // posteriores já rodaram (flaky). waitFor aqui cobre o fim da cadeia.
    await waitFor(() => {
      expect(updateMetadataMutateAsync).toHaveBeenCalledWith({
        publisher_name: null,
        description_markdown: 'Descrição original',
        authors: [],
        artists: [],
      });
      expect(toast.success).toHaveBeenCalledWith('Material atualizado.');
    });
  });

  it('limpa a edição ao trocar o sistema e envia a taxonomia nova', async () => {
    mockMyMaterials({ data: [makeMaterial({ system_id: SYSTEM_A, edition_id: EDITION_A })] });
    const updateMutateAsync = mockUpdateMaterial();
    mockSubmitMaterial();
    mockMaterialHistory();
    mockMaterialMetadata();
    const updateMetadataMutateAsync = mockUpdateMaterialMetadata();

    renderPage();

    fireEvent.change(screen.getByLabelText('Sistema'), { target: { value: SYSTEM_B } });
    expect(screen.getByLabelText('Edição ou variante')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      title: 'Material Original',
      external_url: 'https://exemplo.com/original',
      system_id: SYSTEM_B,
      edition_id: null,
    });
    await waitFor(() => expect(updateMetadataMutateAsync).toHaveBeenCalled());
  });

  it('orienta e envia a capa selecionada', async () => {
    mockDefaults();
    const uploadCover = mockUploadMaterialCover();
    const file = new File([new Uint8Array([1, 2, 3])], 'capa.png', { type: 'image/png' });

    renderPage();

    expect(screen.getByText(/JPEG, PNG ou WebP; até 5 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/1200 × 630 px/i)).toBeInTheDocument();
    const input = screen.getByLabelText('Capa do material');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar capa' }));

    await waitFor(() => expect(uploadCover).toHaveBeenCalledWith(file));
    expect(toast.success).toHaveBeenCalledWith('Capa atualizada.');
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
          material_id: 'material-1',
          field_name: 'title',
          old_value: 'Título Antigo',
          new_value: 'Material Original',
          changed_by: 'user-1',
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
