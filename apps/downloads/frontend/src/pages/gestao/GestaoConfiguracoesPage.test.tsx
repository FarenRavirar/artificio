import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoConfiguracoesPage } from './GestaoConfiguracoesPage';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';
import { logout } from '@artificio/auth/client';

// T1.1 (spec 075) — página de configurações admin: só título + botão de
// logout (mesma ação do painel de usuário 074, contexto admin).


vi.mock('@artificio/auth/client', () => ({
  logout: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
    data: undefined,
  } as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/configuracoes']}>
        <GestaoConfiguracoesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoConfiguracoesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza título e botão de sair', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: /configurações/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('chama logout ao clicar em sair', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /sair/i }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
