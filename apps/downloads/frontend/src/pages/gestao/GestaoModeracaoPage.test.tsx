import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoModeracaoPage } from './GestaoModeracaoPage';
import * as useModerationQueueModule from '../../hooks/useModerationQueue';
import * as useAdminRejectionCategoriesModule from '../../hooks/useAdminRejectionCategories';
import * as useAdminEmailLogModule from '../../hooks/useAdminEmailLog';

// Débito: 27 páginas sem teste de componente (spec 075). Cobertura de
// GestaoModeracaoPage: loading/vazio/lista, seleção + ação em lote
// (aprovar/reprovar/arquivar) e ação individual (aprovar/reprovar), com
// categoria+motivo obrigatórios em reprovação (T6.1 spec 083).


function makeMaterial(overrides: Partial<ReturnType<typeof baseMaterial>> = {}) {
  return { ...baseMaterial(), ...overrides };
}

function baseMaterial() {
  return {
    id: 'material-1',
    slug: 'manual-do-aventureiro',
    title: 'Manual do Aventureiro',
    summary: null,
    description: null,
    material_type: 'pdf',
    access_kind: 'external_link' as const,
    external_url: 'https://example.com/manual.pdf',
    creator_id: 'creator-1',
    editorial_state: 'in_review' as const,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/moderacao']}>
        <GestaoModeracaoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockModerationQueue(overrides: Partial<ReturnType<typeof useModerationQueueModule.useModerationQueue>> = {}) {
  vi.spyOn(useModerationQueueModule, 'useModerationQueue').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useModerationQueueModule.useModerationQueue>);
}

function mockBatchAction(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  vi.spyOn(useModerationQueueModule, 'useModerationBatchAction').mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useModerationQueueModule.useModerationBatchAction>);
  return mutateAsync;
}

function mockSingleAction(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  vi.spyOn(useModerationQueueModule, 'useModerationSingleAction').mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useModerationQueueModule.useModerationSingleAction>);
  return mutateAsync;
}

function mockRejectionCategories(items: Array<{ id: string; label: string; legal_basis?: string }> = []) {
  vi.spyOn(useAdminRejectionCategoriesModule, 'useAdminRejectionCategories').mockReturnValue({
    data: { items },
    isLoading: false,
  } as unknown as ReturnType<typeof useAdminRejectionCategoriesModule.useAdminRejectionCategories>);
}

function mockEmailLog() {
  vi.spyOn(useAdminEmailLogModule, 'useAdminEmailLog').mockReturnValue({
    data: { items: [] },
  } as unknown as ReturnType<typeof useAdminEmailLogModule.useAdminEmailLog>);
  vi.spyOn(useAdminEmailLogModule, 'useRetryEmailLog').mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useAdminEmailLogModule.useRetryEmailLog>);
}

describe('GestaoModeracaoPage', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mockRejectionCategories([{ id: 'cat-1', label: 'Direitos autorais', legal_basis: 'Lei 9.610/98' }]);
    mockEmailLog();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockModerationQueue({ data: undefined, isLoading: true });
    mockBatchAction();
    mockSingleAction();

    renderPage();

    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('mostra mensagem quando a fila está vazia', () => {
    mockModerationQueue({ data: [], isLoading: false });
    mockBatchAction();
    mockSingleAction();

    renderPage();

    expect(screen.getByText('Fila vazia.')).toBeInTheDocument();
  });

  it('renderiza a lista com título e tipo de material', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    mockBatchAction();
    mockSingleAction();

    renderPage();

    expect(screen.getByText('Manual do Aventureiro')).toBeInTheDocument();
    expect(screen.getByText('pdf')).toBeInTheDocument();
  });

  it('aprova um item individualmente sem exigir categoria/motivo', async () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    mockBatchAction();
    const singleMutateAsync = mockSingleAction();

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));

    expect(singleMutateAsync).toHaveBeenCalledWith({ id: 'material-1', action: 'approve' });
  });

  it('bloqueia reprovação individual sem categoria e motivo', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    mockBatchAction();
    const singleMutateAsync = mockSingleAction();

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Reprovar' }));

    expect(alertSpy).toHaveBeenCalledWith('Selecione a categoria e preencha o motivo antes de reprovar.');
    expect(singleMutateAsync).not.toHaveBeenCalled();
  });

  it('reprova um item individualmente com categoria e motivo preenchidos', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    mockBatchAction();
    const singleMutateAsync = mockSingleAction();

    renderPage();

    fireEvent.change(screen.getByDisplayValue('Categoria de reprovação...'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByPlaceholderText('Motivo (obrigatório para reprovar)'), {
      target: { value: 'Conteúdo protegido por direitos autorais' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reprovar' }));

    expect(singleMutateAsync).toHaveBeenCalledWith({
      id: 'material-1',
      action: 'reject',
      reason: 'Conteúdo protegido por direitos autorais',
      rejectionCategoryId: 'cat-1',
    });
  });

  it('mostra a base legal da categoria selecionada', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    mockBatchAction();
    mockSingleAction();

    renderPage();

    fireEvent.change(screen.getByDisplayValue('Categoria de reprovação...'), { target: { value: 'cat-1' } });

    expect(screen.getByText('Base: Lei 9.610/98')).toBeInTheDocument();
  });

  it('aprova selecionados em lote', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    const batchMutateAsync = mockBatchAction();
    mockSingleAction();

    renderPage();

    fireEvent.click(screen.getByLabelText('Selecionar material-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar selecionados' }));

    expect(batchMutateAsync).toHaveBeenCalledWith({
      action: 'approve',
      ids: ['material-1'],
      reason: undefined,
      rejectionCategoryId: undefined,
    });
  });

  it('bloqueia reprovação em lote sem categoria e motivo', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    const batchMutateAsync = mockBatchAction();
    mockSingleAction();

    renderPage();

    fireEvent.click(screen.getByLabelText('Selecionar material-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Reprovar selecionados' }));

    expect(alertSpy).toHaveBeenCalledWith('Categoria e motivo de reprovação são obrigatórios para ação em lote.');
    expect(batchMutateAsync).not.toHaveBeenCalled();
  });

  it('arquiva selecionados em lote', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    const batchMutateAsync = mockBatchAction();
    mockSingleAction();

    renderPage();

    fireEvent.click(screen.getByLabelText('Selecionar material-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar selecionados' }));

    expect(batchMutateAsync).toHaveBeenCalledWith({
      action: 'archive',
      ids: ['material-1'],
      reason: undefined,
      rejectionCategoryId: undefined,
    });
  });

  it('não mostra ações em lote sem itens selecionados', () => {
    mockModerationQueue({ data: [makeMaterial()], isLoading: false });
    mockBatchAction();
    mockSingleAction();

    renderPage();

    expect(screen.queryByRole('button', { name: 'Aprovar selecionados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprovar selecionados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arquivar selecionados' })).not.toBeInTheDocument();
  });
});
