import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoImportarPage } from './GestaoImportarPage';
import * as useParseModule from '../../hooks/useParseOneBookShelfHtml';
import * as useIngestModule from '../../hooks/useIngestScrapedItems';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';
import type { ParseHtmlResponse } from '../../hooks/useParseOneBookShelfHtml';

// T5.3 (spec 085) — render + interacao basica: analisar HTML mostra
// preview, priceSignal=nonzero_price_no_pwyw_tag bloqueia confirmar ate
// o admin marcar isFreeOrPwyw manualmente (D119).

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
      <MemoryRouter initialEntries={['/gestao/materiais/importar']}>
        <GestaoImportarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeParseResponse(overrides: Partial<ParseHtmlResponse['preview']> = {}): ParseHtmlResponse {
  return {
    preview: {
      sourceUrl: 'https://www.dmsguild.com/product/1',
      title: 'Aventura Teste',
      description: 'Descrição teste',
      isFreeOrPwyw: true,
      coverImageUrl: 'https://example.test/capa.jpg',
      publisherName: 'Editora Teste',
      sourceLanguageHint: 'pt',
      extractedPriceValue: 4,
      priceSignal: 'pwyw_tag_present',
      ...overrides,
    },
    duplicateCandidates: [],
    parse_case_id: 'case-1',
  };
}

describe('GestaoImportarPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra preview extraído após analisar', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(makeParseResponse());
    vi.spyOn(useParseModule, 'useParseOneBookShelfHtml').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useParseModule.useParseOneBookShelfHtml>);
    vi.spyOn(useIngestModule, 'useIngestScrapedItems').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useIngestModule.useIngestScrapedItems>);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/cole aqui o html/i), { target: { value: '<html></html>' } });
    fireEvent.click(screen.getByRole('button', { name: /analisar/i }));

    expect(await screen.findByDisplayValue('Aventura Teste')).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledWith({ source_platform: 'dms_guild', html: '<html></html>' });
  });

  it('bloqueia confirmar quando preço sugere produto pago sem revisão manual', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(
      makeParseResponse({ priceSignal: 'nonzero_price_no_pwyw_tag', isFreeOrPwyw: null, extractedPriceValue: 15 }),
    );
    vi.spyOn(useParseModule, 'useParseOneBookShelfHtml').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useParseModule.useParseOneBookShelfHtml>);
    vi.spyOn(useIngestModule, 'useIngestScrapedItems').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useIngestModule.useIngestScrapedItems>);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/cole aqui o html/i), { target: { value: '<html></html>' } });
    fireEvent.click(screen.getByRole('button', { name: /analisar/i }));

    await screen.findByRole('alert');
    const confirmarButton = screen.getByRole('button', { name: /confirmar e publicar/i });
    expect(confirmarButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /grátis ou pague quanto quiser/i }));

    await waitFor(() => expect(confirmarButton).not.toBeDisabled());
  });
});
