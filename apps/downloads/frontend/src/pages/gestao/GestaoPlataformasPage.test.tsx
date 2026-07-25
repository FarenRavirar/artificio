import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoPlataformasPage } from './GestaoPlataformasPage';
import * as usePlatformsModule from '../../hooks/usePlatforms';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';

// T8.2/T8.4 (spec 085, Fase 8) — página de cadastro de plataforma
// (D-D): lista cadastradas + form de cadastro, consumindo o CRUD da T6.4.


function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
    data: undefined,
  } as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/plataformas']}>
        <GestaoPlataformasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoPlataformasPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lista plataformas cadastradas', async () => {
    vi.spyOn(usePlatformsModule, 'usePlatforms').mockReturnValue({
      data: [
        {
          slug: 'dms_guild',
          name: 'DMs Guild',
          domain: 'www.dmsguild.com',
          supports_auto_scrape: false,
          supports_price_recheck: false,
          parser_kind: 'onebookshelf',
          created_at: '2026-07-24T00:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof usePlatformsModule.usePlatforms>);
    vi.spyOn(usePlatformsModule, 'useCreatePlatform').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePlatformsModule.useCreatePlatform>);

    renderPage();

    expect(await screen.findByText('DMs Guild')).toBeInTheDocument();
    expect(screen.getByText('www.dmsguild.com')).toBeInTheDocument();
  });

  it('mostra estado vazio quando nenhuma plataforma cadastrada', async () => {
    vi.spyOn(usePlatformsModule, 'usePlatforms').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePlatformsModule.usePlatforms>);
    vi.spyOn(usePlatformsModule, 'useCreatePlatform').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePlatformsModule.useCreatePlatform>);

    renderPage();

    expect(await screen.findByText(/nenhuma plataforma cadastrada/i)).toBeInTheDocument();
  });

  it('cadastra plataforma nova via formulário', async () => {
    vi.spyOn(usePlatformsModule, 'usePlatforms').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePlatformsModule.usePlatforms>);
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.spyOn(usePlatformsModule, 'useCreatePlatform').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof usePlatformsModule.useCreatePlatform>);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/loja_exemplo/i), { target: { value: 'nova_loja' } });
    fireEvent.change(screen.getByPlaceholderText(/loja exemplo/i), { target: { value: 'Nova Loja' } });
    fireEvent.change(screen.getByPlaceholderText(/loja\.exemplo\.com\.br/i), { target: { value: 'novaloja.com.br' } });
    fireEvent.click(screen.getByRole('button', { name: /^cadastrar$/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'nova_loja', name: 'Nova Loja', domain: 'novaloja.com.br', parser_kind: 'json_ld_generic' }),
      ),
    );
  });
});
