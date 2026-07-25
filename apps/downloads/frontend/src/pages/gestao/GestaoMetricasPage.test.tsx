import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoMetricasPage } from './GestaoMetricasPage';
import * as useAdminMetricsModule from '../../hooks/useAdminMetrics';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';

// T6.3 (spec 075) — página de métricas administrativas: tabela por
// material (downloads/views), estado de loading e nota exibida quando
// presente no payload.

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
  vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
    data: undefined,
  } as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/metricas']}>
        <GestaoMetricasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoMetricasPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza tabela de métricas por material', async () => {
    vi.spyOn(useAdminMetricsModule, 'useAdminMetrics').mockReturnValue({
      data: {
        per_material: [
          {
            material_id: 'mat-1',
            material_slug: 'mapa-tesouro',
            material_title: 'Mapa do Tesouro',
            total_downloads: 42,
            total_views: 100,
          },
        ],
        note: 'Dados atualizados a cada hora.',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useAdminMetricsModule.useAdminMetrics>);

    renderPage();

    expect(screen.getByRole('heading', { name: 'Métricas' })).toBeInTheDocument();
    expect(screen.getByText('Dados atualizados a cada hora.')).toBeInTheDocument();
    expect(await screen.findByText('Mapa do Tesouro')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
  });

  it('mostra estado de carregamento', () => {
    vi.spyOn(useAdminMetricsModule, 'useAdminMetrics').mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useAdminMetricsModule.useAdminMetrics>);

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renderiza tabela vazia quando não há materiais', () => {
    vi.spyOn(useAdminMetricsModule, 'useAdminMetrics').mockReturnValue({
      data: {
        per_material: [],
        note: '',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useAdminMetricsModule.useAdminMetrics>);

    renderPage();

    expect(screen.getByRole('heading', { name: 'Métricas' })).toBeInTheDocument();
    expect(screen.getByText('Material')).toBeInTheDocument();
    expect(screen.getByText('Downloads')).toBeInTheDocument();
    expect(screen.getByText('Views')).toBeInTheDocument();
  });
});
