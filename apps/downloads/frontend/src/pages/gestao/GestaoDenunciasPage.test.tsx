import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoDenunciasPage } from './GestaoDenunciasPage';
import * as useReportsQueueModule from '../../hooks/useReportsQueue';

// T4.1/T4.2 (spec 075) — cobertura de teste do débito (27 páginas sem
// teste de componente): render de loading/vazio/lista, e fluxo de
// decisão (resolver/dispensar) passando resolution_note digitada.


function makeReport(overrides: Partial<ReturnType<typeof baseReport>> = {}) {
  return { ...baseReport(), ...overrides };
}

function baseReport() {
  return {
    id: 'report-1',
    material_id: 'material-1',
    reporter_user_id: 'user-1',
    category: 'copyright',
    priority: 'P0' as const,
    case_state: 'open' as const,
    details: 'Conteúdo infringe direitos autorais',
    resolution_note: null,
    created_at: '2026-07-01T00:00:00.000Z',
    resolved_at: null,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/denuncias']}>
        <GestaoDenunciasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockReportsQueue(overrides: Partial<ReturnType<typeof useReportsQueueModule.useReportsQueue>> = {}) {
  vi.spyOn(useReportsQueueModule, 'useReportsQueue').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useReportsQueueModule.useReportsQueue>);
}

function mockReportDecision(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  vi.spyOn(useReportsQueueModule, 'useReportDecision').mockReturnValue({
    mutateAsync,
  } as unknown as ReturnType<typeof useReportsQueueModule.useReportDecision>);
  return mutateAsync;
}

describe('GestaoDenunciasPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockReportsQueue({ data: undefined, isLoading: true });
    mockReportDecision();

    renderPage();

    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há denúncias pendentes', () => {
    mockReportsQueue({ data: [], isLoading: false });
    mockReportDecision();

    renderPage();

    expect(screen.getByText('Nenhuma denúncia pendente.')).toBeInTheDocument();
  });

  it('renderiza a lista de denúncias com prioridade, categoria e detalhes', () => {
    mockReportsQueue({ data: [makeReport()], isLoading: false });
    mockReportDecision();

    renderPage();

    expect(screen.getByText(/P0 — copyright/)).toBeInTheDocument();
    expect(screen.getByText('Conteúdo infringe direitos autorais')).toBeInTheDocument();
  });

  it('resolve uma denúncia enviando a nota de resolução digitada', async () => {
    mockReportsQueue({ data: [makeReport()], isLoading: false });
    const mutateAsync = mockReportDecision();

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Nota de resolução'), {
      target: { value: 'Verificado, conteúdo removido' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'report-1',
      case_state: 'resolved',
      resolution_note: 'Verificado, conteúdo removido',
    });
  });

  it('dispensa uma denúncia', async () => {
    mockReportsQueue({ data: [makeReport()], isLoading: false });
    const mutateAsync = mockReportDecision();

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Dispensar' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'report-1',
      case_state: 'dismissed',
      resolution_note: undefined,
    });
  });
});
