import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { GestaoImportarPage } from './GestaoImportarPage';
import * as useParseModule from '../../hooks/useParseHtml';
import * as useIngestModule from '../../hooks/useIngestScrapedItems';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';
import type { ParseHtmlResponse } from '../../hooks/useParseHtml';

// T5.3 (spec 085) — render + interacao basica: analisar HTML mostra
// preview, priceSignal=nonzero_price_no_pwyw_tag bloqueia confirmar ate
// o admin marcar isFreeOrPwyw manualmente (D119).
// T8.4 (spec 085, Fase 8) — <select> de plataforma removido (T8.1):
// payload de analisar passa a ser só { html }, plataforma vem detectada
// na resposta (detectedPlatform), exibida como texto no preview.


vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
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
    detectedPlatform: { slug: 'dms_guild', name: 'DMs Guild' },
  };
}

describe('GestaoImportarPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    (toast.success as ReturnType<typeof vi.fn>).mockClear();
    (toast.error as ReturnType<typeof vi.fn>).mockClear();
  });

  it('mostra preview extraído após analisar, sem escolher plataforma (payload só { html })', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(makeParseResponse());
    vi.spyOn(useParseModule, 'useParseHtml').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useParseModule.useParseHtml>);
    vi.spyOn(useIngestModule, 'useIngestScrapedItems').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useIngestModule.useIngestScrapedItems>);

    renderPage();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/cole aqui o html/i), { target: { value: '<html></html>' } });
    fireEvent.click(screen.getByRole('button', { name: /analisar/i }));

    expect(await screen.findByDisplayValue('Aventura Teste')).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledWith({ html: '<html></html>' });
    expect(screen.getByText('DMs Guild')).toBeInTheDocument();
  });

  it('avisa quando o ingest pula o item por duplicata em vez de anunciar sucesso', async () => {
    const parseMutateAsync = vi.fn().mockResolvedValue(makeParseResponse());
    vi.spyOn(useParseModule, 'useParseHtml').mockReturnValue({
      mutateAsync: parseMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useParseModule.useParseHtml>);

    const ingestMutateAsync = vi.fn().mockResolvedValue({
      id: 'run-1',
      items_created: 0,
      items_skipped_duplicate: 1,
      items_skipped_not_portuguese: 0,
      items_skipped_error: 0,
    });
    vi.spyOn(useIngestModule, 'useIngestScrapedItems').mockReturnValue({
      mutateAsync: ingestMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useIngestModule.useIngestScrapedItems>);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/cole aqui o html/i), { target: { value: '<html></html>' } });
    fireEvent.click(screen.getByRole('button', { name: /analisar/i }));
    await screen.findByDisplayValue('Aventura Teste');

    fireEvent.click(screen.getByRole('button', { name: /confirmar e publicar/i }));

    await waitFor(() => expect(ingestMutateAsync).toHaveBeenCalled());
    expect(ingestMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ source_platform: 'dms_guild' }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Item pulado: já existe material duplicado.'));
    expect(toast.success).not.toHaveBeenCalled();
    // formulario nao deve ser limpo quando nada foi criado
    expect(await screen.findByDisplayValue('Aventura Teste')).toBeInTheDocument();
  });

  it('bloqueia confirmar quando preço sugere produto pago sem revisão manual', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(
      makeParseResponse({ priceSignal: 'nonzero_price_no_pwyw_tag', isFreeOrPwyw: null, extractedPriceValue: 15 }),
    );
    vi.spyOn(useParseModule, 'useParseHtml').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useParseModule.useParseHtml>);
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
