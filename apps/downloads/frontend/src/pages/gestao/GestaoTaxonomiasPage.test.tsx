import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoTaxonomiasPage } from './GestaoTaxonomiasPage';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';

// T1.1 (spec 075) — página placeholder de taxonomias: sem hooks/fetch próprios,
// só confirma render dentro do GestaoShell (que consome useAdminSummary).

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
      <MemoryRouter initialEntries={['/gestao/taxonomias']}>
        <GestaoTaxonomiasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoTaxonomiasPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza o título e o texto explicativo do placeholder', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Taxonomias' })).toBeInTheDocument();
    expect(screen.getByText(/sistemas e edições são geridos no site/i)).toBeInTheDocument();
  });
});
