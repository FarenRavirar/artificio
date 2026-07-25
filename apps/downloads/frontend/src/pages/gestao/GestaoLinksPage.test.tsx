import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoLinksPage } from './GestaoLinksPage';
import * as useAdminLinksModule from '../../hooks/useAdminLinks';

// T5.1-T5.3 (spec 075) — página de status de link por material.


function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/links']}>
        <GestaoLinksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoLinksPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    vi.spyOn(useAdminLinksModule, 'useAdminLinks').mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useAdminLinksModule.useAdminLinks>);
    vi.spyOn(useAdminLinksModule, 'useCheckLink').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminLinksModule.useCheckLink>);

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra estado vazio quando nenhum link checado', async () => {
    vi.spyOn(useAdminLinksModule, 'useAdminLinks').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useAdminLinksModule.useAdminLinks>);
    vi.spyOn(useAdminLinksModule, 'useCheckLink').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminLinksModule.useCheckLink>);

    renderPage();

    expect(await screen.findByText('Nenhum link checado ainda.')).toBeInTheDocument();
  });

  it('lista links com status saudável e degradado', async () => {
    vi.spyOn(useAdminLinksModule, 'useAdminLinks').mockReturnValue({
      data: [
        {
          id: 'link-1',
          material_id: 'mat-1',
          material_slug: 'mat-um',
          material_title: 'Material Saudável',
          checked_url: 'https://example.com/mat-um',
          http_status: 200,
          is_healthy: true,
          error_detail: null,
          checked_at: '2026-07-24T00:00:00.000Z',
        },
        {
          id: 'link-2',
          material_id: 'mat-2',
          material_slug: 'mat-dois',
          material_title: 'Material Degradado',
          checked_url: 'https://example.com/mat-dois',
          http_status: 404,
          is_healthy: false,
          error_detail: null,
          checked_at: '2026-07-24T00:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useAdminLinksModule.useAdminLinks>);
    vi.spyOn(useAdminLinksModule, 'useCheckLink').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminLinksModule.useCheckLink>);

    renderPage();

    expect(await screen.findByText('Material Saudável')).toBeInTheDocument();
    expect(screen.getByText('saudável')).toBeInTheDocument();
    expect(screen.getByText('Material Degradado')).toBeInTheDocument();
    expect(screen.getByText('degradado (404)')).toBeInTheDocument();
  });

  it('dispara checagem sob demanda ao clicar em "Checar agora"', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.spyOn(useAdminLinksModule, 'useAdminLinks').mockReturnValue({
      data: [
        {
          id: 'link-1',
          material_id: 'mat-1',
          material_slug: 'mat-um',
          material_title: 'Material Saudável',
          checked_url: 'https://example.com/mat-um',
          http_status: 200,
          is_healthy: true,
          error_detail: null,
          checked_at: '2026-07-24T00:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useAdminLinksModule.useAdminLinks>);
    vi.spyOn(useAdminLinksModule, 'useCheckLink').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useAdminLinksModule.useCheckLink>);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /checar agora/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('mat-1'));
  });
});
