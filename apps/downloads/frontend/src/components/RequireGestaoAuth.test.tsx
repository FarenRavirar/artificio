import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequireGestaoAuth } from './RequireGestaoAuth';
import * as authClientModule from '@artificio/auth/client';
import * as useCreatorRoleModule from '../hooks/useCreatorRole';

// Achado real (review PR #201, Codex, P2): /gestao/plataformas liberava
// acesso pra moderator no frontend, mas GET/POST /platforms exige
// role=admin no backend — moderator via a pagina e o item de sidebar, mas
// toda acao dava 403. requiredRole="admin" restringe o guard sem duplicar
// RequireGestaoAuth pra essa unica rota.

function mockSession(overrides: Partial<ReturnType<typeof authClientModule.useSession>> = {}) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({
    user: { id: 'user-1', name: 'Fulano', email: 'fulano@example.com' },
    loading: false,
    ...overrides,
  } as unknown as ReturnType<typeof authClientModule.useSession>);
}

function mockCreatorRole(overrides: Partial<ReturnType<typeof useCreatorRoleModule.useCreatorRole>> = {}) {
  vi.spyOn(useCreatorRoleModule, 'useCreatorRole').mockReturnValue({
    data: { role: 'moderator' },
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);
}

function renderGuard(requiredRole?: 'moderator' | 'admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/plataformas']}>
        <RequireGestaoAuth requiredRole={requiredRole}>
          <div data-testid="protected-content">Conteúdo protegido</div>
        </RequireGestaoAuth>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequireGestaoAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('libera moderator quando requiredRole não é informado (default = moderator)', () => {
    mockSession();
    mockCreatorRole({ data: { role: 'moderator' } } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);

    renderGuard();

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('libera admin quando requiredRole não é informado', () => {
    mockSession();
    mockCreatorRole({ data: { role: 'admin' } } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);

    renderGuard();

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('bloqueia moderator quando requiredRole="admin" (achado real: /gestao/plataformas)', () => {
    mockSession();
    mockCreatorRole({ data: { role: 'moderator' } } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);

    renderGuard('admin');

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('Você não tem permissão para acessar a gestão do downloads.')).toBeInTheDocument();
  });

  it('libera admin quando requiredRole="admin"', () => {
    mockSession();
    mockCreatorRole({ data: { role: 'admin' } } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);

    renderGuard('admin');

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('bloqueia usuário sem role de gestão (nem moderator nem admin)', () => {
    mockSession();
    mockCreatorRole({ data: { role: 'user' } } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);

    renderGuard();

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('Você não tem permissão para acessar a gestão do downloads.')).toBeInTheDocument();
  });
});
