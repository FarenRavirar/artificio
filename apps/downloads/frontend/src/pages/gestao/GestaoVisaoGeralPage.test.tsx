import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { GestaoVisaoGeralPage } from './GestaoVisaoGeralPage';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';

// T1.1 (spec 075) — visao geral: contagem por fila (moderacao, denuncias,
// links degradados) e idade da fila mais antiga, estado de loading.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao']}>
        <GestaoVisaoGeralPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoVisaoGeralPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza contagens por fila e idade da fila mais antiga', () => {
    vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
      data: {
        moderation_queue: { count: 3, oldest_since: new Date(Date.now() - 2 * 86400000).toISOString() },
        reports_open: { count: 1, oldest_since: new Date().toISOString() },
        degraded_links: { count: 5 },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

    renderPage();

    expect(screen.getByRole('heading', { name: 'Gestão — Visão geral' })).toBeInTheDocument();
    const emRevisao = screen.getByText('Em revisão');
    expect(emRevisao.previousElementSibling).toHaveTextContent('3');
    const denuncias = screen.getByText('Denúncias abertas');
    expect(denuncias.previousElementSibling).toHaveTextContent('1');
    const linksDegradados = screen.getByText('Links degradados');
    expect(linksDegradados.previousElementSibling).toHaveTextContent('5');
    expect(screen.getByText('mais antigo: 2 dia(s)')).toBeInTheDocument();
    expect(screen.getByText('mais antigo: hoje')).toBeInTheDocument();
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
  });

  it('mostra estado de carregamento', () => {
    vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra "sem itens" quando a fila não tem oldest_since', () => {
    vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
      data: {
        moderation_queue: { count: 0, oldest_since: null },
        reports_open: { count: 0, oldest_since: null },
        degraded_links: { count: 0 },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

    renderPage();

    const semItens = screen.getAllByText('mais antigo: sem itens');
    expect(semItens).toHaveLength(2);
  });
});
