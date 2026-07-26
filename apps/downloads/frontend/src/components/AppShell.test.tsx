import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppShell } from './AppShell';

// T10.4 (spec 086) — prova code-level que "Sobre e uso" saiu do moduleNav
// (Header, T10.2) e passou a viver no footer via Footer.moduleLinks
// (packages/ui, T10.1/T10.3). Header/Footer reais aqui (não os stubs de
// test/setup.ts) porque o que este teste prova é justamente o conteúdo
// renderizado por eles.
vi.mock('@artificio/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificio/ui')>();
  return {
    ...actual,
    useTheme: () => ({ theme: 'dark' }),
    useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
    CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  };
});

vi.mock('@artificio/auth/client', () => ({
  useSession: () => ({ user: null, loading: false }),
  logout: vi.fn(),
  redirectToLogin: vi.fn(),
  getAccountsOrigin: () => 'https://accounts.artificiorpg.com',
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderShell(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppShell>
        <div>conteúdo</div>
        <LocationProbe />
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('não lista "Sobre e uso" no moduleNav do Header', () => {
    renderShell();

    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('link', { name: 'Sobre e uso' })).not.toBeInTheDocument();
  });

  it('lista "Sobre e uso" no footer', () => {
    renderShell();

    const footer = screen.getByRole('contentinfo');
    const link = screen.getByRole('link', { name: 'Sobre e uso' });
    expect(footer).toContainElement(link);
    expect(link).toHaveAttribute('href', '/sobre-e-uso');
  });

  it('busca pelo Header com debounce e preserva a rota inicial do catálogo', async () => {
    renderShell('/');

    const input = screen.getByRole('searchbox', { name: 'Buscar materiais' });
    fireEvent.change(input, { target: { value: 'aventura' } });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/?q=aventura&page=1');
    }, { timeout: 1000 });
  });

  it('leva busca iniciada fora do catálogo para /catalogo', async () => {
    renderShell('/materiais/material-1');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar materiais' }), {
      target: { value: 'mapa' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/catalogo?q=mapa&page=1');
    }, { timeout: 1000 });
  });
});
