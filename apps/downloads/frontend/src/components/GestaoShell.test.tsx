import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoShell } from './GestaoShell';
import * as useAdminSummaryModule from '../hooks/useAdminSummary';
import * as useCreatorRoleModule from '../hooks/useCreatorRole';

// Achado real (review PR #201, Codex, P2): /gestao/plataformas passou a
// exigir requiredRole="admin" (RequireGestaoAuth), mas a sidebar continuava
// listando "Plataformas" pra moderator — clique levava direto pra tela de
// "sem permissão". adminOnly no item filtra a sidebar espelhando o guard.

function mockSummary() {
  vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);
}

function mockCreatorRole(role: 'moderator' | 'admin') {
  vi.spyOn(useCreatorRoleModule, 'useCreatorRole').mockReturnValue({
    data: { role },
    isLoading: false,
  } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);
}

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao']}>
        <GestaoShell>
          <div>conteúdo</div>
        </GestaoShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoShell sidebar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('oculta "Plataformas" da sidebar pra moderator (achado real: rota é admin-only)', () => {
    mockSummary();
    mockCreatorRole('moderator');

    renderShell();

    expect(screen.queryByRole('link', { name: 'Plataformas' })).not.toBeInTheDocument();
  });

  it('mostra "Plataformas" na sidebar pra admin', () => {
    mockSummary();
    mockCreatorRole('admin');

    renderShell();

    expect(screen.getByRole('link', { name: 'Plataformas' })).toBeInTheDocument();
  });

  it('mostra itens não admin-only pra moderator normalmente', () => {
    mockSummary();
    mockCreatorRole('moderator');

    renderShell();

    expect(screen.getByRole('link', { name: 'Materiais' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurações' })).toBeInTheDocument();
  });
});
