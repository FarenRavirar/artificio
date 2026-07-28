import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoPlataformasPage } from './GestaoPlataformasPage';
import * as usePlatformsModule from '../../hooks/usePlatforms';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';
import * as useScraperRunsModule from '../../hooks/useScraperRuns';

// T8.2/T8.4 (spec 085, Fase 8) — página de cadastro de plataforma
// (D-D): lista cadastradas + form de cadastro, consumindo o CRUD da T6.4.


function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
    data: undefined,
  } as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

  // Spec 089 (T5.4) — o bloco de coleta vive nesta página; sem o mock, cada
  // teste daqui bateria na rede pelos hooks de run. `vi.isMockFunction` evita
  // sobrescrever o spy que o próprio teste já configurou antes de renderizar.
  if (!vi.isMockFunction(useScraperRunsModule.useScraperRuns)) {
    vi.spyOn(useScraperRunsModule, 'useScraperRuns').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useScraperRunsModule.useScraperRuns>);
  }
  if (!vi.isMockFunction(useScraperRunsModule.useStartScraperRun)) {
    vi.spyOn(useScraperRunsModule, 'useStartScraperRun').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useScraperRunsModule.useStartScraperRun>);
  }

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

  // Spec 089 (T5.4) — bloco de coleta.
  describe('coleta', () => {
    const platformFixtures = [
      {
        slug: 'opera_rpg',
        name: 'OPERA RPG',
        domain: 'operarpg.com',
        parser_kind: 'json_ld_generic',
        supports_auto_scrape: true,
        supports_price_recheck: false,
        created_at: '2026-07-01T00:00:00.000Z',
      },
      {
        slug: 'loja_manual',
        name: 'Loja Manual',
        domain: 'manual.com',
        parser_kind: 'json_ld_generic',
        supports_auto_scrape: false,
        supports_price_recheck: false,
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ];

    function mockPlatforms() {
      vi.spyOn(usePlatformsModule, 'usePlatforms').mockReturnValue({
        data: platformFixtures,
        isLoading: false,
      } as unknown as ReturnType<typeof usePlatformsModule.usePlatforms>);
      vi.spyOn(usePlatformsModule, 'useCreatePlatform').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof usePlatformsModule.useCreatePlatform>);
    }

    it('dispara run com o slug da fonte escolhida', async () => {
      mockPlatforms();
      const mutateAsync = vi.fn().mockResolvedValue('run-abc12345');
      vi.spyOn(useScraperRunsModule, 'useStartScraperRun').mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useScraperRunsModule.useStartScraperRun>);

      renderPage();

      fireEvent.change(await screen.findByRole('combobox', { name: /fonte/i }), {
        target: { value: 'opera_rpg' },
      });
      fireEvent.click(screen.getByRole('button', { name: /coletar agora/i }));

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('opera_rpg'));
    });

    // Só slug com scraper implementado aceita supports_auto_scrape
    // (backend scraper.ts:433); oferecer o resto renderia 400 na cara do admin.
    it('não oferece fonte sem coleta automática', async () => {
      mockPlatforms();
      renderPage();

      const select = await screen.findByRole('combobox', { name: /fonte/i });
      expect(select).toHaveTextContent('OPERA RPG');
      expect(select).not.toHaveTextContent('Loja Manual');
    });

    it('bloqueia disparo enquanto há run em andamento', async () => {
      mockPlatforms();
      vi.spyOn(useScraperRunsModule, 'useScraperRuns').mockReturnValue({
        data: [
          {
            id: 'run-1',
            source_platform: 'opera_rpg',
            trigger_kind: 'manual',
            status: 'running',
            items_found: 0,
            items_created: 0,
            items_skipped_duplicate: 0,
            items_skipped_not_portuguese: 0,
            items_skipped_error: 0,
            error_detail: null,
            started_at: '2026-07-28T10:00:00.000Z',
            finished_at: null,
          },
        ],
        isLoading: false,
      } as unknown as ReturnType<typeof useScraperRunsModule.useScraperRuns>);

      renderPage();

      fireEvent.change(await screen.findByRole('combobox', { name: /fonte/i }), {
        target: { value: 'opera_rpg' },
      });
      expect(screen.getByRole('button', { name: /coletar agora/i })).toBeDisabled();
      expect(screen.getByText(/run em andamento/i)).toBeInTheDocument();
    });

    // Achado de review PR #224 (Codex, P2 / inline): entre o 202 e o próximo
    // poll, `hasRunning` ainda é false e o botão reabriria — janela de disparo
    // duplo. O flag local segura até a lista confirmar a run.
    it('mantém o disparo bloqueado entre o 202 e a confirmação na lista', async () => {
      mockPlatforms();
      const mutateAsync = vi.fn().mockResolvedValue('run-abc12345');
      vi.spyOn(useScraperRunsModule, 'useStartScraperRun').mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useScraperRunsModule.useStartScraperRun>);

      renderPage();

      fireEvent.change(await screen.findByRole('combobox', { name: /fonte/i }), {
        target: { value: 'opera_rpg' },
      });
      fireEvent.click(screen.getByRole('button', { name: /coletar agora/i }));

      // A lista mockada segue vazia (nenhuma run confirmada), simulando a
      // janela antes do refetch.
      await waitFor(() => expect(screen.getByRole('button', { name: /coletar agora/i })).toBeDisabled());
      expect(screen.getByText(/run em andamento/i)).toBeInTheDocument();
    });

    it('reabre o disparo quando o start falha, sem travar o admin', async () => {
      mockPlatforms();
      const mutateAsync = vi.fn().mockRejectedValue(new Error('backend fora'));
      vi.spyOn(useScraperRunsModule, 'useStartScraperRun').mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useScraperRunsModule.useStartScraperRun>);

      renderPage();

      fireEvent.change(await screen.findByRole('combobox', { name: /fonte/i }), {
        target: { value: 'opera_rpg' },
      });
      fireEvent.click(screen.getByRole('button', { name: /coletar agora/i }));

      await waitFor(() => expect(screen.getByRole('button', { name: /coletar agora/i })).toBeEnabled());
    });

    it('não anuncia "nenhuma plataforma" enquanto a lista carrega', async () => {
      vi.spyOn(usePlatformsModule, 'usePlatforms').mockReturnValue({
        data: undefined,
        isLoading: true,
      } as unknown as ReturnType<typeof usePlatformsModule.usePlatforms>);
      vi.spyOn(usePlatformsModule, 'useCreatePlatform').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof usePlatformsModule.useCreatePlatform>);

      renderPage();

      expect(screen.queryByText(/nenhuma plataforma com coleta automática/i)).not.toBeInTheDocument();
    });

    it('marca como reprovada a run que completou sem criar nada', async () => {
      mockPlatforms();
      vi.spyOn(useScraperRunsModule, 'useScraperRuns').mockReturnValue({
        data: [
          {
            id: 'run-2',
            source_platform: 'itch_io',
            trigger_kind: 'manual',
            status: 'completed',
            items_found: 0,
            items_created: 0,
            items_skipped_duplicate: 0,
            items_skipped_not_portuguese: 0,
            items_skipped_error: 0,
            error_detail: null,
            started_at: '2026-07-28T10:00:00.000Z',
            finished_at: '2026-07-28T10:01:00.000Z',
          },
        ],
        isLoading: false,
      } as unknown as ReturnType<typeof useScraperRunsModule.useScraperRuns>);

      renderPage();

      expect(await screen.findByText(/reprovou/i)).toBeInTheDocument();
    });
  });
});
