import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PerfilPage } from './PerfilPage';
import * as authClientModule from '@artificio/auth/client';

// Débito (27 páginas sem teste de componente) — cobertura de PerfilPage
// (painel do usuário comum, spec 074): perfil somente-leitura, dados vêm
// do SSO via useSession (nome e e-mail), sem formulário/edição.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/painel/perfil']}>
      <PerfilPage />
    </MemoryRouter>,
  );
}

function mockSession(overrides: Partial<ReturnType<typeof authClientModule.useSession>> = {}) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({
    user: { id: 'user-1', name: 'Fulano', email: 'fulano@example.com' },
    loading: false,
    ...overrides,
  } as unknown as ReturnType<typeof authClientModule.useSession>);
}

describe('PerfilPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe título da página', () => {
    mockSession();

    renderPage();

    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
  });

  it('mostra nome e e-mail do usuário logado', () => {
    mockSession();

    renderPage();

    expect(screen.getByText('Fulano')).toBeInTheDocument();
    expect(screen.getByText('fulano@example.com')).toBeInTheDocument();
  });

  it('não quebra quando não há usuário na sessão', () => {
    mockSession({ user: null });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByText('Nome:')).toBeInTheDocument();
    expect(screen.getByText('E-mail:')).toBeInTheDocument();
  });
});
