import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfiguracoesPage } from './ConfiguracoesPage';
import * as authClientModule from '@artificio/auth/client';

// Débito (27 páginas sem teste de componente) — cobertura de ConfiguracoesPage
// (painel do usuário comum, spec 074): render do título e ação de logout.

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
    <MemoryRouter initialEntries={['/painel/configuracoes']}>
      <ConfiguracoesPage />
    </MemoryRouter>,
  );
}

describe('ConfiguracoesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza o título e o botão de sair da conta', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeInTheDocument();
  });

  it('chama logout ao clicar em "Sair da conta"', () => {
    const logoutSpy = vi.spyOn(authClientModule, 'logout').mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });
});
