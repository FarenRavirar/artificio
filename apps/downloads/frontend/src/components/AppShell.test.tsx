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
  it('não duplica o catálogo da página inicial em uma nav interna', () => {
    renderShell();

    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('link', { name: 'Início' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Catálogo' })).not.toBeInTheDocument();
  });

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

// Guard de T7.6 (spec 102): no celular o `downloads` usa LUPA, como os outros 4 apps.
//
// Os casos acima rodam todos como desktop — o mock de `matchMedia` em `test/setup.ts`
// devolve `matches: false` fixo. Sem forçar `true` aqui, a lupa nunca seria exercitada e
// a suíte passaria verde com o comportamento do celular quebrado.
describe('AppShell — busca no celular (T7.6)', () => {
  const matchMediaOriginal = window.matchMedia;

  /** Força ≤860px, onde o header do pacote colapsa nos 4 slots. */
  function colapsarHeader() {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('860'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  it('troca o campo embutido pela lupa', () => {
    // As duas formas são EXCLUSIVAS no `Header` compartilhado: `hasEmbeddedSearch`
    // desliga a lupa. Ter as duas na tela seria dois controles para a mesma ação.
    colapsarHeader();
    renderShell('/');

    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Buscar materiais' })).not.toBeInTheDocument();
  });

  it('a lupa leva à busca do módulo', () => {
    colapsarHeader();
    renderShell('/materiais/material-1');

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    // `/busca` é alias de `/catalogo` (`App.tsx`), mas aqui só o `AppShell` está montado:
    // o que este guard prova é o DESTINO da lupa, não o redirect — esse tem guard próprio
    // em `App.routes.test.tsx`.
    expect(screen.getByTestId('location')).toHaveTextContent('/busca');
  });

  it('no desktop continua com o campo embutido, sem lupa', () => {
    // O mock global devolve `matches: false`: é o caso desktop, que não pode regredir.
    renderShell('/');

    expect(screen.getByRole('searchbox', { name: 'Buscar materiais' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument();
  });
});
